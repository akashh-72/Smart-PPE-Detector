"""
Firebase Realtime Database synchronization module.
Provides non-blocking, resilient sync between the local backend and Firebase RTDB.
"""
import json
import ssl
import threading
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

from config import FIREBASE_DATABASE_URL

# SSL context that safely handles macOS certificate trust chains
_ssl_ctx = ssl.create_default_context()
try:
    import certifi
    _ssl_ctx.load_verify_locations(certifi.where())
except Exception:
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE


def _firebase_request(url: str, method: str = "GET", data: Optional[Dict[str, Any]] = None, timeout: float = 4.0):
    """Executes a REST HTTP request against the Firebase Realtime Database."""
    try:
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"} if body else {},
            method=method,
        )
        with urllib.request.urlopen(req, context=_ssl_ctx, timeout=timeout) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else None
    except Exception as e:
        # Non-fatal: Log warning and continue offline/local operations smoothly
        # print(f"[Firebase Sync Warning] {method} {url}: {e}")
        return None


def _run_async(fn, *args, **kwargs):
    """Runs a function in a detached daemon thread so caller is never blocked."""
    t = threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True)
    t.start()
    return t


def sync_log(log_data: Dict[str, Any]):
    """Sync an access verification scan record to Firebase RTDB."""
    def _task():
        log_id = log_data.get("id") or f"log_{int(log_data.get('timestamp_raw', 0) * 1000)}"
        url = f"{FIREBASE_DATABASE_URL}/access_logs/{log_id}.json"
        _firebase_request(url, method="PUT", data=log_data)
    _run_async(_task)


def clear_logs():
    """Clear access verification logs from Firebase RTDB."""
    def _task():
        url = f"{FIREBASE_DATABASE_URL}/access_logs.json"
        _firebase_request(url, method="DELETE")
    _run_async(_task)


def sync_hardware_state(state: Dict[str, Any]):
    """Publish live hardware state (gate angle, LEDs, buzzer, LCD) to Firebase RTDB."""
    def _task():
        url = f"{FIREBASE_DATABASE_URL}/hardware.json"
        _firebase_request(url, method="PUT", data=state)
    _run_async(_task)


def sync_staff_member(staff_id: Any, staff_data: Dict[str, Any]):
    """Sync an added or updated staff record to Firebase RTDB."""
    def _task():
        url = f"{FIREBASE_DATABASE_URL}/staff/{staff_id}.json"
        _firebase_request(url, method="PUT", data=staff_data)
    _run_async(_task)


def delete_staff_member(staff_id: Any):
    """Remove a staff member from Firebase RTDB."""
    def _task():
        url = f"{FIREBASE_DATABASE_URL}/staff/{staff_id}.json"
        _firebase_request(url, method="DELETE")
    _run_async(_task)


def sync_system_settings(settings: Dict[str, Any]):
    """Sync system settings to Firebase RTDB."""
    def _task():
        url = f"{FIREBASE_DATABASE_URL}/settings.json"
        _firebase_request(url, method="PUT", data=settings)
    _run_async(_task)
