import ipaddress
import os
import re
import socket
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from scrapling.fetchers import Fetcher

app = FastAPI()
MAX_TEXT_CHARS = 60000


class ScrapeRequest(BaseModel):
    url: str
    timeout_ms: int = 25000


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
    budget_ms = max(100, min(25000, int(getattr(payload, "timeout_ms", 25000))))
    deadline = time.monotonic() + budget_ms / 1000
    url = _public_url(payload.url)
    try:
        current = url
        for hop in range(5):
            current = _public_url(current)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise HTTPException(status_code=504, detail={"code": "SCRAPLING_TIMEOUT", "message": "Target extraction deadline exceeded"})
            # The pinned SDK defaults to three attempts; one bounded request per hop
            # keeps this service within its caller's remaining extraction budget.
            page = Fetcher.get(current, stealthy_headers=True, impersonate="chrome", timeout=remaining, retries=1, follow_redirects=False)
            if time.monotonic() >= deadline:
                raise HTTPException(status_code=504, detail={"code": "SCRAPLING_TIMEOUT", "message": "Target extraction deadline exceeded"})
            status = int(getattr(page, "status", 200) or 200)
            if status not in {301, 302, 303, 307, 308}:
                break
            location = page.headers.get("location") or page.headers.get("Location")
            if not location or hop == 4:
                raise HTTPException(status_code=422, detail="Invalid or excessive redirects")
            current = urljoin(current, location)
        if status < 200 or status >= 300:
            raise HTTPException(status_code=422, detail={"code": "SCRAPLING_BLOCKED_CONTENT", "message": "Target page did not return successful content", "target_status": status})
        text = str(page.get_all_text(separator="\n", strip=True) or "").strip()
        if len(text) < 120 or (len(text) < 1000 and re.search(r"captcha|verify you are human|cloudflare ray id|access denied", text, re.I)):
            raise HTTPException(status_code=422, detail={"code": "SCRAPLING_BLOCKED_CONTENT", "message": "No readable page content was returned"})
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
        # curl/provider exceptions may contain target credentials and full URLs.
        timed_out = getattr(exc, "code", None) == 28 or "timeout" in type(exc).__name__.lower()
        raise HTTPException(status_code=504 if timed_out else 502, detail={
            "code": "SCRAPLING_TIMEOUT" if timed_out else "SCRAPLING_EXTRACTION_ERROR",
            "message": "Target extraction timed out" if timed_out else "Target extraction failed",
        }) from exc
