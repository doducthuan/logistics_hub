"""
Giới hạn tần suất yêu cầu quên mật khẩu (in-memory, mỗi worker).
Production nhiều instance nên dùng Redis / DB — user có thể nâng cấp sau.
"""

from __future__ import annotations

import threading
import time

_lock = threading.Lock()
_events: dict[str, list[float]] = {}


def _prune(timestamps: list[float], window_seconds: float) -> list[float]:
    now = time.monotonic()
    cutoff = now - window_seconds
    return [t for t in timestamps if t > cutoff]


def allow(key: str, *, max_requests: int, window_seconds: float) -> bool:
    """Trả True nếu được phép thêm một request; False nếu vượt hạn mức."""
    with _lock:
        now = time.monotonic()
        ts = _events.get(key, [])
        ts = _prune(ts, window_seconds)
        if len(ts) >= max_requests:
            _events[key] = ts
            return False
        ts.append(now)
        _events[key] = ts
        return True


def reset_state_for_tests() -> None:
    """Xóa trạng thái (pytest)."""
    with _lock:
        _events.clear()
