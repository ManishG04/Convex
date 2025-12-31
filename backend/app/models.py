from dataclasses import dataclass, field
from typing import Dict, Optional
import time


@dataclass
class Participant:
    socket_id: str
    username: str
    is_distracted: bool = False


@dataclass
class Room:
    code: str
    participants: Dict[str, Participant] = field(default_factory=dict)
    timer_end_time: Optional[float] = None
    timer_phase: str = "focus"  # "focus" or "break"
    host: Optional[str] = None  # socket_id of host

    def add_participant(self, socket_id: str, username: str) -> Participant:
        participant = Participant(socket_id=socket_id, username=username)
        self.participants[socket_id] = participant

        # First participant becomes host
        if self.host is None:
            self.host = socket_id

        return participant

    def remove_participant(self, socket_id: str) -> Optional[str]:
        """Remove participant and return their username if found."""
        participant = self.participants.pop(socket_id, None)
        if participant is None:
            return None

        # Update host if needed
        if self.host == socket_id:
            self.host = next(iter(self.participants.keys()), None)

        return participant.username

    def get_participant_list(self) -> list:
        return [
            {"username": p.username, "isDistracted": p.is_distracted}
            for p in self.participants.values()
        ]

    def is_empty(self) -> bool:
        return len(self.participants) == 0


class RoomManager:
    """In-memory room state manager."""

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
        return {
            "participants": room.get_participant_list(),
            "timerRunning": room.timer_end_time is not None
            and room.timer_end_time > time.time() * 1000,
            "endTime": room.timer_end_time,
            "phase": room.timer_phase,
        }


# Global room manager instance
room_manager = RoomManager()
