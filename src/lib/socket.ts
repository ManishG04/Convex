import { io, Socket } from "socket.io-client";

// Socket.io client singleton
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      autoConnect: false,
    });
  }
  return socket;
};

// Timer event types
export interface TimerStartEvent {
  endTime: number;
  phase: "focus" | "break";
  durationMins: number;
}

export interface TimerStopEvent {
  roomId: string;
}

export interface UserDistractedEvent {
  username: string;
  isDistracted: boolean;
}

export interface RoomJoinEvent {
  roomCode: string;
  username: string;
}

// Socket event names
export const SOCKET_EVENTS = {
  // Client -> Server
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  TIMER_START: "timer:start",
  TIMER_STOP: "timer:stop",
  USER_DISTRACTED: "user:distracted",
  USER_FOCUSED: "user:focused",

  // Server -> Client
  TIMER_STARTED: "timer:started",
  TIMER_STOPPED: "timer:stopped",
  TIMER_ENDED: "timer:ended",
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",
  USER_STATUS_CHANGED: "user:status-changed",
  ROOM_STATE: "room:state",
} as const;
