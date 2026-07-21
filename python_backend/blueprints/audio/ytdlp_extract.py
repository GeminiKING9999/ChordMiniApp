"""
yt-dlp based YouTube audio extraction for Cloud Run.

Third-party extractors (yt-mp3-go) often run outdated yt-dlp and fail on SABR /
signature changes. This module runs a current yt-dlp on our backend instead.
"""

from __future__ import annotations

import os
import time
import uuid
import tempfile
import threading
from typing import Any, Dict, Optional, Tuple

import requests as http_requests

from utils.logging import log_info, log_error

# token -> {path, expires, content_type, title, duration}
_EXTRACT_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_TTL_SEC = 3600


def _cleanup_expired() -> None:
    now = time.time()
    with _CACHE_LOCK:
        expired = [k for k, v in _EXTRACT_CACHE.items() if v.get("expires", 0) < now]
        for k in expired:
            path = _EXTRACT_CACHE[k].get("path")
            _EXTRACT_CACHE.pop(k, None)
            if path and os.path.isfile(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


def get_cached_extract(token: str) -> Optional[Dict[str, Any]]:
    _cleanup_expired()
    with _CACHE_LOCK:
        entry = _EXTRACT_CACHE.get(token)
        if not entry:
            return None
        if entry.get("expires", 0) < time.time():
            _EXTRACT_CACHE.pop(token, None)
            return None
        return entry


def _store_file(path: str, content_type: str = "audio/mpeg") -> str:
    _cleanup_expired()
    token = uuid.uuid4().hex
    with _CACHE_LOCK:
        _EXTRACT_CACHE[token] = {
            "path": path,
            "content_type": content_type,
            "expires": time.time() + _CACHE_TTL_SEC,
        }
    return token


def _try_firebase_upload(path: str, video_id: str) -> Optional[str]:
    """
    Upload extracted audio to Firebase Storage (temp/) using public REST upload.
    Storage rules on this project allow unauthenticated create under temp/* up to 100MB.
    Returns a public download URL or None.
    """
    bucket = (
        os.environ.get("FIREBASE_STORAGE_BUCKET")
        or os.environ.get("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
        or "chordmini-5ea94.firebasestorage.app"
    )
    # Prefer .appspot.com for legacy REST if needed
    object_name = f"temp/ytdlp_{video_id}_{int(time.time())}.mp3"
    upload_url = (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o"
        f"?uploadType=media&name={requests_quote(object_name)}"
    )

    try:
        with open(path, "rb") as fh:
            resp = http_requests.post(
                upload_url,
                data=fh,
                headers={"Content-Type": "audio/mpeg"},
                timeout=120,
            )
        if not resp.ok:
            log_error(f"Firebase upload failed: {resp.status_code} {resp.text[:300]}")
            return None

        # Build download URL
        encoded_name = requests_quote(object_name, safe="")
        meta = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        token = (meta.get("downloadTokens") or "").split(",")[0]
        if token:
            return f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded_name}?alt=media&token={token}"
        return f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded_name}?alt=media"
    except Exception as e:
        log_error(f"Firebase upload error: {e}")
        return None


def requests_quote(value: str, safe: str = "/") -> str:
    from urllib.parse import quote

    return quote(value, safe=safe)


def extract_audio_with_ytdlp(
    video_id: str,
    preferred_title: str = "",
    public_base_url: str = "",
) -> Tuple[bool, Dict[str, Any]]:
    """
    Download audio with yt-dlp and return a publicly fetchable audio URL.

    Returns (success, payload_dict).
    """
    try:
        import yt_dlp
    except ImportError as e:
        return False, {"error": f"yt-dlp not installed: {e}"}

    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.mkdtemp(prefix="chord_ytdlp_")
    outtmpl = os.path.join(temp_dir, f"{video_id}.%(ext)s")

    ydl_opts: Dict[str, Any] = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": False,
        "retries": 3,
        "fragment_retries": 3,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        # Prefer clients that often work without a browser JS runtime on servers
        "extractor_args": {
            "youtube": {
                "player_client": ["android_vr", "android", "ios", "mweb", "web"],
            }
        },
    }

    # Optional cookies (Cloud Run datacenter IPs often need these for YouTube bot checks)
    # Set YTDLP_COOKIES_FILE to a path, or YTDLP_COOKIES_B64 to base64-encoded Netscape cookies.txt
    cookiefile = os.environ.get("YTDLP_COOKIES_FILE", "").strip()
    cookies_b64 = os.environ.get("YTDLP_COOKIES_B64", "").strip()
    if cookies_b64 and not cookiefile:
        try:
            import base64

            cookie_path = os.path.join(tempfile.gettempdir(), "ytdlp_cookies.txt")
            with open(cookie_path, "wb") as cf:
                cf.write(base64.b64decode(cookies_b64))
            cookiefile = cookie_path
            log_info("Loaded yt-dlp cookies from YTDLP_COOKIES_B64")
        except Exception as e:
            log_error(f"Failed to decode YTDLP_COOKIES_B64: {e}")
    if cookiefile and os.path.isfile(cookiefile):
        ydl_opts["cookiefile"] = cookiefile
        log_info(f"Using yt-dlp cookiefile: {cookiefile}")

    title = preferred_title or f"YouTube Video {video_id}"
    duration = 0.0

    try:
        log_info(f"yt-dlp extract start: {video_id}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            if info:
                title = info.get("title") or title
                duration = float(info.get("duration") or 0)

        mp3_path = os.path.join(temp_dir, f"{video_id}.mp3")
        if not os.path.isfile(mp3_path):
            # Find any audio file produced
            for name in os.listdir(temp_dir):
                if name.endswith((".mp3", ".m4a", ".webm", ".opus", ".wav")):
                    mp3_path = os.path.join(temp_dir, name)
                    break

        if not os.path.isfile(mp3_path):
            return False, {"error": "yt-dlp finished but no audio file was produced"}

        size_mb = os.path.getsize(mp3_path) / (1024 * 1024)
        log_info(f"yt-dlp extract done: {video_id} ({size_mb:.2f}MB) title={title}")

        # Prefer Firebase public URL (works across Cloud Run instances)
        firebase_url = _try_firebase_upload(mp3_path, video_id)
        if firebase_url:
            try:
                os.remove(mp3_path)
            except OSError:
                pass
            return True, {
                "success": True,
                "audioUrl": firebase_url,
                "title": title,
                "duration": duration,
                "fromCache": False,
                "isStreamUrl": False,
                "method": "yt-dlp-firebase",
            }

        # Fallback: serve from this instance for 1 hour
        token = _store_file(mp3_path, "audio/mpeg")
        base = (public_base_url or os.environ.get("PUBLIC_BACKEND_URL") or "").rstrip("/")
        if not base:
            base = "https://chordmini-backend-607485523232.us-east1.run.app"
        audio_url = f"{base}/api/extracted-audio/{token}"

        return True, {
            "success": True,
            "audioUrl": audio_url,
            "title": title,
            "duration": duration,
            "fromCache": False,
            "isStreamUrl": False,
            "method": "yt-dlp",
        }

    except Exception as e:
        log_error(f"yt-dlp extract failed for {video_id}: {e}")
        return False, {
            "error": str(e),
            "suggestion": (
                "YouTube blocked extraction or the video is restricted. "
                "Try a different video or upload an audio file."
            ),
        }
