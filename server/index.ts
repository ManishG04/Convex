import "dotenv/config";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3000",
      /\.devtunnels\.ms$/, // Allow all VS Code dev tunnels
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory state (fine for prototype)
interface Participant {
  socketId: string;
  username: string;
  isDistracted: boolean;
}

interface Room {
  code: string;
  participants: Map<string, Participant>;
  timerEndTime: number | null;
  timerPhase: "focus" | "break";
  host: string | null; // first participant's socketId
}

const rooms = new Map<string, Room>();

// Socket event names
const EVENTS = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  TIMER_START: "timer:start",
  TIMER_STOP: "timer:stop",
  USER_DISTRACTED: "user:distracted",
  USER_FOCUSED: "user:focused",
  TIMER_STARTED: "timer:started",
  TIMER_STOPPED: "timer:stopped",
  TIMER_ENDED: "timer:ended",
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",
  USER_STATUS_CHANGED: "user:status-changed",
  ROOM_STATE: "room:state",
} as const;

function getOrCreateRoom(code: string): Room {
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      participants: new Map(),
      timerEndTime: null,
      timerPhase: "focus",
      host: null,
    });
  }
  return rooms.get(code)!;
}

function getRoomState(room: Room) {
  return {
    participants: Array.from(room.participants.values()).map((p) => ({
      username: p.username,
      isDistracted: p.isDistracted,
    })),
    timerRunning: room.timerEndTime !== null && room.timerEndTime > Date.now(),
    endTime: room.timerEndTime,
    phase: room.timerPhase,
  };
}

io.on("connection", (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);
  let currentRoom: string | null = null;
  let currentUsername: string | null = null;

  socket.on(
    EVENTS.ROOM_JOIN,
    ({ roomCode, username }: { roomCode: string; username: string }) => {
      console.log(`${username} joining room ${roomCode}`);

      const room = getOrCreateRoom(roomCode);

      // Add participant
      room.participants.set(socket.id, {
        socketId: socket.id,
        username,
        isDistracted: false,
      });

      // Set host if first participant
      if (room.host === null) {
        room.host = socket.id;
      }

      currentRoom = roomCode;
      currentUsername = username;

      // Join socket room
      socket.join(roomCode);

      // Send current room state to the joining user
      socket.emit(EVENTS.ROOM_STATE, getRoomState(room));

      // Notify others
      socket.to(roomCode).emit(EVENTS.USER_JOINED, { username });

      console.log(
        `Room ${roomCode} now has ${room.participants.size} participants`
      );
    }
  );

  socket.on(EVENTS.ROOM_LEAVE, ({ roomCode }: { roomCode: string }) => {
    handleLeaveRoom(socket, roomCode);
  });

  socket.on(EVENTS.TIMER_START, ({ phase }: { phase?: "focus" | "break" }) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    // Only host can start timer
    if (room.host !== socket.id) {
      console.log("Non-host tried to start timer");
      return;
    }

    const timerPhase = phase || "focus";
    const durationMins = timerPhase === "focus" ? 25 : 5;
    const endTime = Date.now() + durationMins * 60 * 1000;

    room.timerEndTime = endTime;
    room.timerPhase = timerPhase;

    console.log(
      `Timer started in room ${currentRoom}: ${timerPhase} for ${durationMins}min`
    );

    // Broadcast to all in room (including sender)
    io.to(currentRoom).emit(EVENTS.TIMER_STARTED, {
      endTime,
      phase: timerPhase,
      durationMins,
    });

    // Set up timer end callback
    setTimeout(() => {
      if (room.timerEndTime === endTime) {
        room.timerEndTime = null;
        io.to(currentRoom!).emit(EVENTS.TIMER_ENDED);
        console.log(`Timer ended in room ${currentRoom}`);
      }
    }, durationMins * 60 * 1000);
  });

  socket.on(EVENTS.TIMER_STOP, () => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    // Only host can stop timer
    if (room.host !== socket.id) return;

    room.timerEndTime = null;

    io.to(currentRoom).emit(EVENTS.TIMER_STOPPED);
    console.log(`Timer stopped in room ${currentRoom}`);
  });

  socket.on(EVENTS.USER_DISTRACTED, () => {
    if (!currentRoom || !currentUsername) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.isDistracted = true;
      io.to(currentRoom).emit(EVENTS.USER_STATUS_CHANGED, {
        username: currentUsername,
        isDistracted: true,
      });
      console.log(`${currentUsername} is distracted`);
    }
  });

  socket.on(EVENTS.USER_FOCUSED, () => {
    if (!currentRoom || !currentUsername) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.isDistracted = false;
      io.to(currentRoom).emit(EVENTS.USER_STATUS_CHANGED, {
        username: currentUsername,
        isDistracted: false,
      });
      console.log(`${currentUsername} is focused`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    if (currentRoom) {
      handleLeaveRoom(socket, currentRoom);
    }
  });

  function handleLeaveRoom(socket: Socket, roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    const username = participant.username;
    room.participants.delete(socket.id);

    // Update host if needed
    if (room.host === socket.id) {
      const firstParticipant = room.participants.keys().next().value;
      room.host = firstParticipant || null;
    }

    socket.leave(roomCode);
    socket.to(roomCode).emit(EVENTS.USER_LEFT, { username });

    console.log(`${username} left room ${roomCode}`);

    // Clean up empty rooms
    if (room.participants.size === 0) {
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted (empty)`);
    }
  }
});

const PORT = process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
});
