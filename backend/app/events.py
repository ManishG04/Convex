# Socket event constants
class Events:
    # Client -> Server
    ROOM_JOIN = "room:join"
    ROOM_LEAVE = "room:leave"
    TIMER_START = "timer:start"
    TIMER_STOP = "timer:stop"
    USER_DISTRACTED = "user:distracted"
    USER_FOCUSED = "user:focused"
    BLEND_SHAPES = "avatar:blend-shapes"  # Avatar blend shapes from client

    # Server -> Client
    TIMER_STARTED = "timer:started"
    TIMER_STOPPED = "timer:stopped"
    TIMER_ENDED = "timer:ended"
    USER_JOINED = "user:joined"
    USER_LEFT = "user:left"
    USER_STATUS_CHANGED = "user:status-changed"
    ROOM_STATE = "room:state"
    BLEND_SHAPES_UPDATE = (
        "avatar:blend-shapes-update"  # Broadcast blend shapes to others
    )
