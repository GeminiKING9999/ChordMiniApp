"""
Audio extraction routes for ChordMini Flask application.

Primary path: local yt-dlp on Cloud Run (up-to-date, 600s timeout).
Fallback: yt-mp3-go third-party (often outdated yt-dlp; fails on SABR).
"""

import json
import re
import time
import os

import requests as http_requests
from flask import Blueprint, request, jsonify, send_file
from extensions import limiter
from config import get_config
from utils.logging import log_info, log_error
from blueprints.audio.ytdlp_extract import extract_audio_with_ytdlp, get_cached_extract

# Create blueprint
audio_bp = Blueprint('audio', __name__)

config = get_config()

# yt-mp3-go service configuration (fallback only)
YT_MP3_GO_BASE = 'https://lukavukanovic.xyz'
YT_MP3_GO_PATH = '/yt-downloader'
DEFAULT_QUALITY = 'low'  # low quality is sufficient for chord/beat analysis
JOB_TIMEOUT = 300  # 5 minutes max
POLL_INTERVAL = 2  # seconds between SSE reconnects


def _sanitize_video_id(video_id: str) -> str:
    """Sanitize and validate a YouTube video ID."""
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '', video_id)
    return sanitized if len(sanitized) == 11 else ''


def _generate_safe_filename(video_id: str, title: str = None) -> str:
    """Generate a filesystem-safe filename from video title or ID."""
    if title:
        safe = re.sub(r'[^\w\s-]', '', title)
        safe = re.sub(r'\s+', '_', safe.strip())
        if safe:
            return safe[:100]
    return video_id


def _poll_sse_for_completion(job_id: str, timeout: int = JOB_TIMEOUT) -> dict:
    """
    Poll the yt-mp3-go SSE endpoint until the job completes or fails.

    Returns dict with 'success', 'audio_url' or 'error'.
    """
    start_time = time.time()
    url = f'{YT_MP3_GO_BASE}{YT_MP3_GO_PATH}/events?id={job_id}'

    while time.time() - start_time < timeout:
        try:
            resp = http_requests.get(
                url,
                headers={
                    'Accept': 'text/event-stream',
                    'User-Agent': 'ChordMiniApp/1.0'
                },
                stream=True,
                timeout=60
            )

            if not resp.ok:
                log_error(f"SSE stream request failed: {resp.status_code}")
                time.sleep(POLL_INTERVAL)
                continue

            buffer = ''
            for chunk in resp.iter_content(chunk_size=1024, decode_unicode=True):
                if time.time() - start_time > timeout:
                    resp.close()
                    return {'success': False, 'error': 'Job timed out'}

                if chunk is None:
                    continue

                buffer += chunk

                # Process complete SSE event blocks (separated by double newline)
                while '\n\n' in buffer:
                    block, buffer = buffer.split('\n\n', 1)
                    result = _parse_sse_block(block, job_id)
                    if result is not None:
                        resp.close()
                        return result

            resp.close()

        except http_requests.exceptions.Timeout:
            log_info(f"SSE read timed out for job {job_id}, reconnecting...")
            continue
        except http_requests.exceptions.ConnectionError:
            log_error(f"SSE connection error for job {job_id}, retrying...")
            time.sleep(POLL_INTERVAL)
            continue
        except Exception as e:
            log_error(f"SSE error for job {job_id}: {e}")
            time.sleep(POLL_INTERVAL)
            continue

        time.sleep(POLL_INTERVAL)

    return {'success': False, 'error': 'Job timed out'}


def _parse_sse_block(block: str, job_id: str) -> dict | None:
    """
    Parse an SSE event block. Returns a result dict if terminal, None if processing.
    """
    data_lines = []
    for line in block.split('\n'):
        if line.startswith('data:'):
            data_lines.append(line[5:].strip())

    if not data_lines:
        return None

    payload = '\n'.join(data_lines)
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        return None

    status = event.get('status', '')

    if status == 'complete' and event.get('filePath'):
        # filePath is like "downloads/jobID/filename.mp3"
        file_path = event['filePath']
        relative_path = file_path.replace('downloads/', '', 1)
        download_url = f'{YT_MP3_GO_BASE}{YT_MP3_GO_PATH}/downloads/{relative_path}'
        log_info(f"Job {job_id} completed: {download_url}")
        return {'success': True, 'audio_url': download_url}

    if status == 'failed':
        error_msg = event.get('error', 'Unknown extraction error')
        log_error(f"Job {job_id} failed: {error_msg}")
        return {'success': False, 'error': f'Extraction failed: {error_msg}'}

    # Still processing
    return None


@audio_bp.route('/api/extracted-audio/<token>', methods=['GET', 'HEAD', 'OPTIONS'])
def serve_extracted_audio(token: str):
    """Serve a short-lived audio file produced by yt-dlp on this instance."""
    if request.method == 'OPTIONS':
        return ('', 204)

    entry = get_cached_extract(token)
    if not entry:
        return jsonify({'error': 'Extracted audio not found or expired'}), 404

    path = entry.get('path')
    if not path or not os.path.isfile(path):
        return jsonify({'error': 'Extracted audio file missing'}), 404

    return send_file(
        path,
        mimetype=entry.get('content_type') or 'audio/mpeg',
        as_attachment=False,
        download_name=f'{token}.mp3',
        conditional=True,
    )


@audio_bp.route('/api/extract-audio', methods=['POST'])
@limiter.limit(config.get_rate_limit('heavy_processing'))
def extract_audio():
    """
    Extract audio from a YouTube video.

    Primary: yt-dlp on this Cloud Run service (current extractor).
    Fallback: yt-mp3-go third-party (often fails with outdated yt-dlp).

    Request JSON:
        - videoId (str, required): YouTube video ID (11 chars)
        - forceRefresh (bool, optional): Force re-extraction
        - originalTitle (str, optional): Video title from search
        - videoMetadata (dict, optional): Additional metadata

    Returns JSON:
        - success (bool)
        - audioUrl (str): Direct download URL for the audio
        - title (str)
        - duration (float)
        - method (str): 'yt-dlp' | 'yt-dlp-firebase' | 'yt-mp3-go'
    """
    if not request.is_json:
        return jsonify({'success': False, 'error': 'Request must be JSON'}), 400

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Request body is required'}), 400

    video_id = data.get('videoId', '')
    sanitized_id = _sanitize_video_id(video_id)
    if not sanitized_id:
        return jsonify({'success': False, 'error': 'Invalid videoId'}), 400

    original_title = data.get('originalTitle', '')
    video_metadata = data.get('videoMetadata', {}) or {}
    title = original_title or video_metadata.get('title', f'YouTube Video {sanitized_id}')

    log_info(f"Audio extraction request: {sanitized_id} ({title})")

    public_base = os.environ.get('PUBLIC_BACKEND_URL', '').rstrip('/')
    if not public_base:
        # Stable production URL (avoids multi-instance temp-file misses when Firebase upload fails)
        if os.environ.get('K_SERVICE'):
            public_base = 'https://chordmini-backend-607485523232.us-east1.run.app'
        else:
            proto = request.headers.get('X-Forwarded-Proto', 'https')
            host = request.headers.get('X-Forwarded-Host', request.host)
            public_base = f'{proto}://{host}'.rstrip('/')

    # --- Primary: local yt-dlp ---
    ok, payload = extract_audio_with_ytdlp(
        sanitized_id,
        preferred_title=title,
        public_base_url=public_base,
    )
    if ok:
        return jsonify(payload)

    ytdlp_error = payload.get('error', 'yt-dlp failed')
    log_error(f"yt-dlp primary path failed for {sanitized_id}: {ytdlp_error}; trying yt-mp3-go fallback")

    youtube_url = f'https://www.youtube.com/watch?v={sanitized_id}'

    try:
        # Fallback: yt-mp3-go (often outdated; kept as last resort)
        info_title = title
        info_duration = 0
        try:
            info_resp = http_requests.post(
                f'{YT_MP3_GO_BASE}{YT_MP3_GO_PATH}/info',
                data={'url': youtube_url},
                headers={
                    'User-Agent': 'ChordMiniApp/1.0',
                    'Referer': f'{YT_MP3_GO_BASE}{YT_MP3_GO_PATH}/'
                },
                timeout=30
            )
            if info_resp.ok:
                info_data = info_resp.json()
                info_title = info_data.get('title', title)
                info_duration = info_data.get('duration', 0)
                log_info(f"Video info: title={info_title}, duration={info_duration}")
        except Exception as e:
            log_error(f"Info request failed (non-fatal): {e}")

        safe_filename = _generate_safe_filename(sanitized_id, info_title)
        job_resp = http_requests.post(
            f'{YT_MP3_GO_BASE}{YT_MP3_GO_PATH}/download',
            json={
                'videoID': sanitized_id,
                'quality': DEFAULT_QUALITY,
                'filename': safe_filename
            },
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'ChordMiniApp/1.0',
                'Referer': f'{YT_MP3_GO_BASE}{YT_MP3_GO_PATH}/'
            },
            timeout=30
        )

        if not job_resp.ok:
            error_text = job_resp.text
            log_error(f"Job creation failed: {job_resp.status_code} - {error_text}")
            return jsonify({
                'success': False,
                'error': f'All extraction methods failed. yt-dlp: {ytdlp_error}. yt-mp3-go: {job_resp.status_code}',
                'suggestion': 'Try uploading an audio file instead, or a different video.',
            }), 502

        job_data = job_resp.json()
        job_id = job_data.get('jobID')

        if not job_id:
            log_error(f"No jobID in response: {job_data}")
            return jsonify({
                'success': False,
                'error': f'All extraction methods failed. yt-dlp: {ytdlp_error}. yt-mp3-go: no job ID',
            }), 502

        log_info(f"Extraction job created: {job_id}")

        result = _poll_sse_for_completion(job_id, timeout=JOB_TIMEOUT)

        if not result['success']:
            return jsonify({
                'success': False,
                'error': (
                    f"All extraction methods failed. yt-dlp: {ytdlp_error}. "
                    f"yt-mp3-go: {result.get('error', 'Extraction failed')}"
                ),
                'suggestion': 'The video may be restricted. Try uploading an audio file instead.',
            }), 500

        log_info(f"Extraction complete for {sanitized_id}: {result['audio_url']}")

        return jsonify({
            'success': True,
            'audioUrl': result['audio_url'],
            'title': info_title,
            'duration': info_duration,
            'fromCache': False,
            'isStreamUrl': False,
            'method': 'yt-mp3-go'
        })

    except http_requests.exceptions.Timeout:
        log_error(f"External service timeout for {sanitized_id}")
        return jsonify({
            'success': False,
            'error': f'Audio extraction timed out. yt-dlp: {ytdlp_error}',
            'suggestion': 'Try again or upload an audio file.',
        }), 504

    except Exception as e:
        log_error(f"Audio extraction error for {sanitized_id}: {e}")
        return jsonify({
            'success': False,
            'error': f'yt-dlp: {ytdlp_error}; fallback: {e}',
            'suggestion': 'Please try again or upload an audio file.',
        }), 500
