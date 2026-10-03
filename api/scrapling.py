import ipaddress
import os
import re
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from scrapling.fetchers import Fetcher

app = FastAPI()
MAX_TEXT_CHARS = 60000


class ScrapeRequest(BaseModel):
    url: str


def _authorized(authorization: str | None) -> bool:
    token = os.getenv("SCRAPLING_SERVICE_TOKEN", "").strip()
    if not token:
        return False
    return authorization == f"Bearer {token}"


def _public_url(value: str) -> str:
    parsed = urlparse(str(value or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="A valid public http/https URL is required")
    host = parsed.hostname.rstrip(".").lower()
    if host in {"localhost"} or host.endswith((".localhost", ".local", ".internal", ".lan")):
        raise HTTPException(status_code=400, detail="Private or local URLs are not allowed")
    try:
        addresses = {
            row[4][0]
            for row in socket.getaddrinfo(
                host,
                parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        }
    except socket.gaierror as exc:
        raise HTTPException(status_code=422, detail="Unable to resolve target host") from exc
    for raw in addresses:
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            continue
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Private or non-global target addresses are not allowed")
    return parsed.geturl()


def _title(page) -> str:
    try:
        value = page.css("title::text").get()
        return str(value or "").strip()[:180]
    except Exception:
        return ""


@app.get("/health")
def health():
    return {"status": "ok", "service": "leadintel-scrapling", "revision": os.getenv("RENDER_GIT_COMMIT", "unknown"), "protected": bool(os.getenv("SCRAPLING_SERVICE_TOKEN", "").strip())}


@app.post("/api/scrapling")
def scrape(payload: ScrapeRequest, authorization: str | None = Header(default=None)):
    if not _authorized(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")
    url = _public_url(payload.url)
    try:
        current = url
        for hop in range(5):
            current = _public_url(current)
            page = Fetcher.get(current, stealthy_headers=True, impersonate="chrome", timeout=25, allow_redirects=False)
            status = int(getattr(page, "status", 200) or 200)
            if status not in {301, 302, 303, 307, 308}:
                break
            location = page.headers.get("location") or page.headers.get("Location")
            if not location or hop == 4:
                raise HTTPException(status_code=422, detail="Invalid or excessive redirects")
            current = urljoin(current, location)
        if status < 200 or status >= 300:
            raise HTTPException(status_code=422, detail="Target page did not return successful content")
        text = str(page.get_all_text(separator="\n", strip=True) or "").strip()
        if len(text) < 120 or (len(text) < 1000 and re.search(r"captcha|verify you are human|cloudflare ray id|access denied", text, re.I)):
            raise HTTPException(status_code=422, detail="No readable page content was returned")
        status = int(getattr(page, "status", 200) or 200)
        final_url = _public_url(str(getattr(page, "url", current) or current))
        links = list(dict.fromkeys(urljoin(final_url, str(link)) for link in page.css("a::attr(href)").getall() if str(link).strip()))[:200]
        return {
            "success": True,
            "data": {
                "markdown": text[:MAX_TEXT_CHARS],
                "links": links,
                "metadata": {
                    "title": _title(page) or urlparse(final_url).hostname,
                    "sourceURL": final_url,
                    "url": final_url,
                    "statusCode": status,
                    "source": "scrapling-fallback",
                    "fetchedAt": datetime.now(timezone.utc).isoformat(),
                },
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scrapling extraction failed: {str(exc)[:160]}") from exc
