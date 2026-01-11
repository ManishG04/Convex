from dataclasses import dataclass, field
from typing import Dict, Optional, List
import time

try:
    from .config import settings
except Exception:

    class _Dummy:
        FOCUS_DURATION = 25
        BREAK_DURATION = 5

    settings = _Dummy()


@dataclass
class Participant:
    socket_id: str
    username: str
    is_distracted: bool = False
    avatar_url: Optional[str] = None

    focused_since: Optional[float] = (
        None  
    )
    distracted_since: Optional[float] = (
        None  
    )
    total_focused_ms: int = 0
    total_distracted_ms: int = 0
    score: float = 0.0
    is_confused: bool = False
    confusion_events: int = 0

    def __post_init__(self):
        now_ms = time.time() * 1000
        self.focused_since = now_ms
        self.distracted_since = None

    def mark_distracted(self):
        now_ms = time.time() * 1000
        if self.focused_since is not None:
            delta = int(now_ms - self.focused_since)
            self.total_focused_ms += delta
            self.focused_since = None
        if self.distracted_since is None:
            self.distracted_since = now_ms
        self.is_distracted = True

    def mark_focused(self):
        now_ms = time.time() * 1000
        if self.distracted_since is not None:
            delta = int(now_ms - self.distracted_since)
            self.total_distracted_ms += delta
            self.distracted_since = None
        if self.focused_since is None:
            self.focused_since = now_ms
        self.is_distracted = False

    def record_confusion(self):
        self.is_confused = True
        self.confusion_events += 1

    def finalize_on_leave(self) -> dict:
        now_ms = time.time() * 1000
        if self.focused_since is not None:
            self.total_focused_ms += int(now_ms - self.focused_since)
            self.focused_since = None
        if self.distracted_since is not None:
            self.total_distracted_ms += int(now_ms - self.distracted_since)
            self.distracted_since = None

        session_ms = self.total_focused_ms + self.total_distracted_ms
        focus_pct = (
            (self.total_focused_ms / session_ms * 100) if session_ms > 0 else 0.0
        )

        return {
            "username": self.username,
            "totalFocusedMs": self.total_focused_ms,
            "totalDistractedMs": self.total_distracted_ms,
            "focusPercentage": round(focus_pct, 2),
            "scoreGained": round(self.score, 2),
            "confusionEvents": self.confusion_events,
            "sessionDurationMs": session_ms,
        }


@dataclass
class Room:
    code: str
    participants: Dict[str, Participant] = field(default_factory=dict)
    timer_end_time: Optional[float] = None
    timer_phase: str = "focus"  
    host: Optional[str] = None  

    group_score: float = 0.0
    base_dps: float = 1.0  
    penalty_per_distracted: float = (
        0.25  
    )

    def add_participant(
        self, socket_id: str, username: str, avatar_url: Optional[str] = None
    ) -> Participant:
        participant = Participant(
            socket_id=socket_id, username=username, avatar_url=avatar_url
        )
        self.participants[socket_id] = participant

        if self.host is None:
            self.host = socket_id

        return participant

    def remove_participant(self, socket_id: str) -> Optional[str]:
        participant = self.participants.pop(socket_id, None)
        if participant is None:
            return None

        if self.host == socket_id:
            self.host = next(iter(self.participants.keys()), None)

        return participant.username

    def get_participant_list(self) -> list:
        return [
            {
                "username": p.username,
                "isDistracted": p.is_distracted,
                "avatarUrl": p.avatar_url,
                "isConfused": p.is_confused,
                "score": round(p.score, 2),
                "totalFocusedMs": p.total_focused_ms,
                "totalDistractedMs": p.total_distracted_ms,
                "confusionEvents": p.confusion_events,
            }
            for p in self.participants.values()
        ]

    def is_empty(self) -> bool:
        return len(self.participants) == 0

    def current_num_distracted(self) -> int:
        return sum(1 for p in self.participants.values() if p.is_distracted)

    def compute_group_dps(self) -> float:
        num_distracted = self.current_num_distracted()
        penalty = self.penalty_per_distracted * num_distracted
        effective = max(0.0, 1.0 - min(penalty, 0.95))
        return self.base_dps * effective

    def tick_and_distribute_score(self, seconds: float = 1.0):
        dps = self.compute_group_dps()
        pts = dps * seconds
        focused = [p for p in self.participants.values() if not p.is_distracted]
        if not focused:
            self.group_score += 0
            return

        share = pts / len(focused)
        for p in focused:
            p.score += share
        self.group_score += pts

    def get_room_state(self) -> dict:
        now_ms = time.time() * 1000
        timer_running = (
            self.timer_end_time is not None and self.timer_end_time > time.time() * 1000
        )
        return {
            "participants": self.get_participant_list(),
            "timerRunning": timer_running,
            "endTime": self.timer_end_time,
            "phase": self.timer_phase,
            "groupScore": round(self.group_score, 2),
            "groupDPS": round(self.compute_group_dps(), 3),
            "numDistracted": self.current_num_distracted(),
            "serverTimeMs": now_ms,
        }


class RoomManager:

    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def get_or_create_room(self, code: str) -> Room:
        if code not in self.rooms:
            self.rooms[code] = Room(code=code)
        return self.rooms[code]

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code)

    def delete_room(self, code: str) -> None:
        self.rooms.pop(code, None)

    def get_room_state(self, room: Room) -> dict:
        return room.get_room_state()


room_manager = RoomManager()
