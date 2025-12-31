"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket, SOCKET_EVENTS } from "@/lib/socket";

interface Participant {
  username: string;
  isDistracted: boolean;
}

interface RoomState {
  participants: Participant[];
  timerRunning: boolean;
  endTime: number | null;
  phase: "focus" | "break";
}

export function useRoom(roomCode: string, username: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      console.log("Socket connected");
      setIsConnected(true);
      // Join room after connecting
      socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomCode, username });
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    };

    const handleRoomState = (state: RoomState) => {
      console.log("Room state received:", state);
      setParticipants(state.participants);
    };

    const handleUserJoined = (data: { username: string }) => {
      console.log("User joined:", data.username);
      setParticipants((prev) => {
        if (prev.find((p) => p.username === data.username)) return prev;
        return [...prev, { username: data.username, isDistracted: false }];
      });
    };

    const handleUserLeft = (data: { username: string }) => {
      console.log("User left:", data.username);
      setParticipants((prev) =>
        prev.filter((p) => p.username !== data.username)
      );
    };

    const handleUserStatusChanged = (data: {
      username: string;
      isDistracted: boolean;
    }) => {
      console.log("User status changed:", data);
      setParticipants((prev) =>
        prev.map((p) =>
          p.username === data.username
            ? { ...p, isDistracted: data.isDistracted }
            : p
        )
      );
    };

    const handleError = (err: { message: string }) => {
      console.error("Socket error:", err);
      setError(err.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(SOCKET_EVENTS.USER_STATUS_CHANGED, handleUserStatusChanged);
    socket.on("error", handleError);

    // Connect socket
    socket.connect();

    return () => {
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomCode });
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(SOCKET_EVENTS.USER_STATUS_CHANGED, handleUserStatusChanged);
      socket.off("error", handleError);
      socket.disconnect();
    };
  }, [roomCode, username]);

  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomCode });
    socket.disconnect();
  }, [roomCode]);

  return {
    isConnected,
    participants,
    error,
    leaveRoom,
  };
}
