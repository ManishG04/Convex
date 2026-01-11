import time
import asyncio
import socketio
from typing import Dict

from .config import settings
from .models import room_manager, Room
from .events import Events

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
)

sessions: Dict[str, dict] = {}

METRICS_BROADCAST_INTERVAL = getattr(settings, "METRICS_INTERVAL", 5)


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
    participant = room.add_participant(sid, username, avatar_url)

    sessions[sid] = {"room_code": room_code, "username": username}

    await sio.enter_room(sid, room_code)

    await sio.emit(Events.ROOM_STATE, room_manager.get_room_state(room), to=sid)

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

    participant = room.participants.get(sid)

    username = room.remove_participant(sid)
    if not username:
        return

    metrics_payload = None
    if participant:
        metrics_payload = participant.finalize_on_leave()
        metrics_payload["roomCode"] = room_code
        metrics_payload["groupScoreAtLeave"] = round(room.group_score, 2)
        try:
            await sio.emit(Events.USER_METRICS, metrics_payload, to=sid)
        except Exception:
            await sio.emit(Events.USER_METRICS, metrics_payload, room=room_code)

    await sio.leave_room(sid, room_code)
    await sio.emit(Events.USER_LEFT, {"username": username}, room=room_code)

    print(f"{username} left room {room_code}")

    await sio.emit(Events.ROOM_STATE, room_manager.get_room_state(room), room=room_code)

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

    await sio.emit(
        Events.TIMER_STARTED,
        {
            "endTime": end_time,
            "phase": phase,
            "durationMins": duration_mins,
        },
        room=room_code,
    )

    asyncio.create_task(timer_end_callback(room_code, end_time, duration_mins * 60))


async def timer_end_callback(
    room_code: str, expected_end_time: float, delay_seconds: int
):
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
        participant.mark_distracted()
        await sio.emit(
            Events.USER_STATUS_CHANGED,
            {"username": username, "isDistracted": True},
            room=room_code,
        )
        print(f"{username} is distracted")

        dps = room.compute_group_dps()
        await sio.emit(
            Events.GROUP_DPS_UPDATED, {"groupDPS": round(dps, 3)}, room=room_code
        )
        room.tick_and_distribute_score(seconds=0)  # no time added, but keep logic path

        await sio.emit(
            Events.GROUP_SCORE_UPDATED,
            {"groupScore": round(room.group_score, 2)},
            room=room_code,
        )
        await sio.emit(
            Events.ROOM_STATE, room_manager.get_room_state(room), room=room_code
        )


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
        participant.mark_focused()
        await sio.emit(
            Events.USER_STATUS_CHANGED,
            {"username": username, "isDistracted": False},
            room=room_code,
        )
        print(f"{username} is focused")

        dps = room.compute_group_dps()
        room.tick_and_distribute_score(seconds=1.0)
        await sio.emit(
            Events.GROUP_DPS_UPDATED, {"groupDPS": round(dps, 3)}, room=room_code
        )
        await sio.emit(
            Events.GROUP_SCORE_UPDATED,
            {"groupScore": round(room.group_score, 2)},
            room=room_code,
        )
        await sio.emit(
            Events.ROOM_STATE, room_manager.get_room_state(room), room=room_code
        )


@sio.on(Events.BLEND_SHAPES)
async def handle_blend_shapes(sid, data):
    session = sessions.get(sid)
    if not session:
        return

    room_code = session["room_code"]
    username = session["username"]
    room = room_manager.get_room(room_code)

    await sio.emit(
        Events.BLEND_SHAPES_UPDATE,
        {"username": username, "blendShapes": data},
        room=room_code,
        skip_sid=sid,
    )
    try:
        furrow_threshold = 0.45
        detected = False
        if isinstance(data, dict):
            for k, v in data.items():
                try:
                    if "brow" in k.lower():
                        value = float(v)
                        if value >= furrow_threshold:
                            detected = True
                            break
                except Exception:
                    continue

        if detected and room:
            participant = room.participants.get(sid)
            if participant:
                participant.record_confusion()
                await sio.emit(
                    Events.USER_CONFUSED,
                    {
                        "username": username,
                        "isConfused": True,
                        "confusionEvents": participant.confusion_events,
                    },
                    room=room_code,
                )
                print(f"Confusion detected for {username} in room {room_code}")

                await sio.emit(
                    Events.ROOM_STATE, room_manager.get_room_state(room), room=room_code
                )
    except Exception as e:
        print("Error during confusion detection:", e)


def _format_room_console_output(room: Room) -> str:
    lines = []
    now_ms = int(time.time() * 1000)
    lines.append(f"=== Room {room.code} metrics @ {now_ms} ===")
    lines.append(
        f"Participants: {len(room.participants)} | GroupScore: {round(room.group_score,2)} | GroupDPS: {round(room.compute_group_dps(),3)} | TimerPhase: {room.timer_phase}"
    )
    for p in room.participants.values():
        lines.append(
            f"- {p.username} | distracted={p.is_distracted} | confused={p.is_confused} | score={round(p.score,2)} | focusedMs={p.total_focused_ms} | distractedMs={p.total_distracted_ms} | confusionEvents={p.confusion_events}"
        )
    lines.append("========================================")
    return "\n".join(lines)


async def print_and_emit_all_metrics_once():
    try:
        rooms_snapshot = list(room_manager.rooms.values())
        for room in rooms_snapshot:
            try:
                console_str = _format_room_console_output(room)
                print(console_str)
            except Exception as e:
                print("Error formatting/printing room metrics:", e)

            try:
                state = room.get_room_state()
                await sio.emit(Events.ROOM_STATE, state, room=room.code)
                await sio.emit(
                    Events.GROUP_DPS_UPDATED,
                    {"groupDPS": round(room.compute_group_dps(), 3)},
                    room=room.code,
                )
                await sio.emit(
                    Events.GROUP_SCORE_UPDATED,
                    {"groupScore": round(room.group_score, 2)},
                    room=room.code,
                )
            except Exception as e:
                print(f"Error emitting metrics for room {room.code}: {e}")

    except Exception as e:
        print("Error in print_and_emit_all_metrics_once:", e)


async def metrics_broadcast_loop():
    interval = float(METRICS_BROADCAST_INTERVAL)
    print(f"Starting metrics broadcast loop (interval={interval}s)")
    while True:
        try:
            await asyncio.sleep(interval)

            rooms_snapshot = list(room_manager.rooms.values())
            for room in rooms_snapshot:
                try:
                    room.tick_and_distribute_score(seconds=interval)

                    console_str = _format_room_console_output(room)
                    print(console_str)
                    state = room.get_room_state()
                    await sio.emit(Events.ROOM_STATE, state, room=room.code)
                    await sio.emit(
                        Events.GROUP_DPS_UPDATED,
                        {"groupDPS": round(room.compute_group_dps(), 3)},
                        room=room.code,
                    )
                    await sio.emit(
                        Events.GROUP_SCORE_UPDATED,
                        {"groupScore": round(room.group_score, 2)},
                        room=room.code,
                    )
                except Exception as r_e:
                    print(
                        f"Error processing metrics for room {getattr(room, 'code', '<unknown>')}: {r_e}"
                    )
        except Exception as e:
            print("Error in metrics_broadcast_loop:", e)
            await asyncio.sleep(1.0)


try:
    sio.start_background_task(metrics_broadcast_loop)
except Exception as e:
    print("Failed to start metrics_broadcast_loop automatically:", e)
