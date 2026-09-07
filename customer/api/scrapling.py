import ipaddress
import os
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

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
        return True
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


@app.get("/api/scrapling")
def health():
    return {"status": "ok", "service": "leadintel-scrapling"}


@app.post("/api/scrapling")
def scrape(payload: ScrapeRequest, authorization: str | None = Header(default=None)):
    if not _authorized(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")
    url = _public_url(payload.url)
    try:
        page = Fetcher.get(url, stealthy_headers=True, impersonate="chrome", timeout=30000)
        text = str(page.get_all_text(separator="\n", strip=True) or "").strip()
        if not text:
            raise HTTPException(status_code=422, detail="No readable page content was returned")
        status = int(getattr(page, "status", 200) or 200)
        final_url = str(getattr(page, "url", url) or url)
        return {
            "success": True,
            "data": {
                "markdown": text[:MAX_TEXT_CHARS],
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
