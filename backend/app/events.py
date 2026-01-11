class Events:
    ROOM_JOIN = "room:join"
    ROOM_LEAVE = "room:leave"
    ROOM_STATE = "room:state"
    USER_JOINED = "user:joined"
    USER_LEFT = "user:left"

    TIMER_START = "timer:start"
    TIMER_STARTED = "timer:started"
    TIMER_ENDED = "timer:ended"
    TIMER_STOP = "timer:stop"
    TIMER_STOPPED = "timer:stopped"

    USER_DISTRACTED = "user:distracted"
    USER_FOCUSED = "user:focused"
    USER_STATUS_CHANGED = "user:status_changed"

    BLEND_SHAPES = "blend:shapes"
    BLEND_SHAPES_UPDATE = "blend:shapes_update"

    USER_CONFUSED = "user:confused"  # emitted when a furrowed-brow event detected

    GROUP_SCORE_UPDATED = "group:score_updated"
    GROUP_DPS_UPDATED = "group:dps_updated"

    USER_METRICS = "user:metrics"
