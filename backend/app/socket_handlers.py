import time
import asyncio
import socketio
from typing import Dict

from .config import settings
from .models import room_manager
from .events import Events


# Create Socket.IO server with CORS
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
)

# Track session data: socket_id -> {room_code, username}
sessions: Dict[str, dict] = {}


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
    session = sessions.pop(sid, None)
    if session:
        await handle_leave_room(sid, session["room_code"])


@sio.on(Events.ROOM_JOIN)
async def handle_room_join(sid, data):
    room_code = data.get("roomCode")
    username = data.get("username")
    avatar_url = data.get("avatarUrl")  # Avatar URL from client

    if not room_code or not username:
        return

    print(f"{username} joining room {room_code} with avatar: {avatar_url}")

    room = room_manager.get_or_create_room(room_code)
    room.add_participant(sid, username, avatar_url)

    # Store session data
    sessions[sid] = {"room_code": room_code, "username": username}

    # Join socket room
    await sio.enter_room(sid, room_code)

    # Send current room state to joining user
    await sio.emit(Events.ROOM_STATE, room_manager.get_room_state(room), to=sid)

    # Notify others (include avatar URL so they can display the avatar)
    await sio.emit(
        Events.USER_JOINED,
        {"username": username, "avatarUrl": avatar_url},
        room=room_code,
        skip_sid=sid,
    )

    print(f"Room {room_code} now has {len(room.participants)} participants")


@sio.on(Events.ROOM_LEAVE)
async def handle_room_leave(sid, data):
    room_code = data.get("roomCode")
    if room_code:
        await handle_leave_room(sid, room_code)


async def handle_leave_room(sid: str, room_code: str):
    room = room_manager.get_room(room_code)
    if not room:
        return

    username = room.remove_participant(sid)
    if not username:
        return

    await sio.leave_room(sid, room_code)
    await sio.emit(Events.USER_LEFT, {"username": username}, room=room_code)

    print(f"{username} left room {room_code}")

    # Clean up empty rooms
    if room.is_empty():
        room_manager.delete_room(room_code)
        print(f"Room {room_code} deleted (empty)")


@sio.on(Events.TIMER_START)
async def handle_timer_start(sid, data):
    session = sessions.get(sid)
    if not session:
        return

    room_code = session["room_code"]
    room = room_manager.get_room(room_code)
    if not room:
        return

    # Only host can start timer
    if room.host != sid:
        print("Non-host tried to start timer")
        return

    phase = data.get("phase", "focus")
    duration_mins = (
        settings.FOCUS_DURATION if phase == "focus" else settings.BREAK_DURATION
    )
    end_time = time.time() * 1000 + duration_mins * 60 * 1000  # milliseconds

    room.timer_end_time = end_time
    room.timer_phase = phase

    print(f"Timer started in room {room_code}: {phase} for {duration_mins}min")

    # Broadcast to all in room
    await sio.emit(
        Events.TIMER_STARTED,
        {
            "endTime": end_time,
            "phase": phase,
            "durationMins": duration_mins,
        },
        room=room_code,
    )

    # Schedule timer end
    asyncio.create_task(timer_end_callback(room_code, end_time, duration_mins * 60))


async def timer_end_callback(
    room_code: str, expected_end_time: float, delay_seconds: int
):
    """Callback to handle timer end after delay."""
    await asyncio.sleep(delay_seconds)

    room = room_manager.get_room(room_code)
    if room and room.timer_end_time == expected_end_time:
        room.timer_end_time = None
        await sio.emit(Events.TIMER_ENDED, room=room_code)
        print(f"Timer ended in room {room_code}")


@sio.on(Events.TIMER_STOP)
async def handle_timer_stop(sid, data=None):
    session = sessions.get(sid)
    if not session:
        return

    room_code = session["room_code"]
    room = room_manager.get_room(room_code)
    if not room:
        return

    # Only host can stop timer
    if room.host != sid:
        return

    room.timer_end_time = None

    await sio.emit(Events.TIMER_STOPPED, room=room_code)
    print(f"Timer stopped in room {room_code}")


@sio.on(Events.USER_DISTRACTED)
async def handle_user_distracted(sid, data=None):
    session = sessions.get(sid)
    if not session:
        return

    room_code = session["room_code"]
    username = session["username"]
    room = room_manager.get_room(room_code)

    if not room:
        return

    participant = room.participants.get(sid)
    if participant:
        participant.is_distracted = True
        await sio.emit(
            Events.USER_STATUS_CHANGED,
            {"username": username, "isDistracted": True},
            room=room_code,
        )
        print(f"{username} is distracted")


@sio.on(Events.USER_FOCUSED)
async def handle_user_focused(sid, data=None):
    session = sessions.get(sid)
    if not session:
        return

    room_code = session["room_code"]
    username = session["username"]
    room = room_manager.get_room(room_code)

    if not room:
        return

    participant = room.participants.get(sid)
    if participant:
        participant.is_distracted = False
        await sio.emit(
            Events.USER_STATUS_CHANGED,
            {"username": username, "isDistracted": False},
            room=room_code,
        )
        print(f"{username} is focused")


@sio.on(Events.BLEND_SHAPES)
async def handle_blend_shapes(sid, data):
    """
    Receive blend shapes from a client and broadcast to others in the room.
    This enables real-time avatar animation sync.
    """
    session = sessions.get(sid)
    if not session:
        return

    room_code = session["room_code"]
    username = session["username"]

    # Broadcast to all others in the room (skip sender)
    await sio.emit(
        Events.BLEND_SHAPES_UPDATE,
        {"username": username, "blendShapes": data},
        room=room_code,
        skip_sid=sid,
    )
