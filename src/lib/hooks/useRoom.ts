"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket, SOCKET_EVENTS } from "@/lib/socket";
import type { BlendShapes } from "@/lib/blendShapeMapping";

interface Participant {
  username: string;
  isDistracted: boolean;
  avatarUrl?: string;
}

interface RoomState {
  participants: Participant[];
  timerRunning: boolean;
  endTime: number | null;
  phase: "focus" | "break";
}

// Simplified blend shapes for network sync (face-only mode)
export interface NetworkBlendShapes {
  // Head rotation
  headRotationX: number;
  headRotationY: number;
  headRotationZ: number;
  // Head position
  headPosX: number;
  headPosY: number;
  headPosZ: number;
  // Face
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  jawOpen: number;
  mouthSmile: number;
}

// Get avatar URL from localStorage
function getStoredAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("selectedAvatar");
}

// Convert full BlendShapes to network format (face-only)
function toNetworkBlendShapes(bs: BlendShapes): NetworkBlendShapes {
  return {
    headRotationX: Math.round(bs.headRotationX * 1000) / 1000,
    headRotationY: Math.round(bs.headRotationY * 1000) / 1000,
    headRotationZ: Math.round(bs.headRotationZ * 1000) / 1000,
    headPosX: Math.round(bs.headPosition.x * 1000) / 1000,
    headPosY: Math.round(bs.headPosition.y * 1000) / 1000,
    headPosZ: Math.round(bs.headPosition.z * 1000) / 1000,
    eyeBlinkLeft: Math.round(bs.eyeBlinkLeft * 100) / 100,
    eyeBlinkRight: Math.round(bs.eyeBlinkRight * 100) / 100,
    jawOpen: Math.round(bs.jawOpen * 100) / 100,
    mouthSmile: Math.round(bs.mouthSmile * 100) / 100,
  };
}

export function useRoom(roomCode: string, username: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Use ref for high-frequency blend shape updates to avoid re-render loops
  const remoteBlendShapesRef = useRef<Map<string, NetworkBlendShapes>>(
    new Map()
  );
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    const socket = getSocket();
    const avatarUrl = getStoredAvatarUrl();

    const handleConnect = () => {
      console.log("Socket connected");
      setIsConnected(true);
      // Join room after connecting - include avatar URL
      socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomCode, username, avatarUrl });
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    };

    const handleRoomState = (state: RoomState) => {
      console.log("Room state received:", state);
      setParticipants(state.participants);
    };

    const handleUserJoined = (data: {
      username: string;
      avatarUrl?: string;
    }) => {
      console.log(
        "User joined:",
        data.username,
        "with avatar:",
        data.avatarUrl
      );
      setParticipants((prev) => {
        if (prev.find((p) => p.username === data.username)) return prev;
        return [
          ...prev,
          {
            username: data.username,
            isDistracted: false,
            avatarUrl: data.avatarUrl,
          },
        ];
      });
    };

    const handleUserLeft = (data: { username: string }) => {
      console.log("User left:", data.username);
      setParticipants((prev) =>
        prev.filter((p) => p.username !== data.username)
      );
      // Clean up blend shapes for left user
      remoteBlendShapesRef.current.delete(data.username);
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

    // High-frequency handler - just update the ref, no state changes
    const handleBlendShapesUpdate = (data: {
      username: string;
      blendShapes: NetworkBlendShapes;
    }) => {
      remoteBlendShapesRef.current.set(data.username, data.blendShapes);
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
    socket.on(SOCKET_EVENTS.BLEND_SHAPES_UPDATE, handleBlendShapesUpdate);
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
      socket.off(SOCKET_EVENTS.BLEND_SHAPES_UPDATE, handleBlendShapesUpdate);
      socket.off("error", handleError);
      socket.disconnect();
    };
  }, [roomCode, username]);

  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomCode });
    socket.disconnect();
  }, [roomCode]);

  // Send blend shapes to server (throttled to ~20fps for network efficiency)
  const sendBlendShapes = useCallback((blendShapes: BlendShapes) => {
    const now = Date.now();
    if (now - lastSentRef.current < 50) return; // ~20fps throttle (was 33ms/30fps)
    lastSentRef.current = now;

    const socket = getSocket();
    if (socket.connected) {
      socket.emit(
        SOCKET_EVENTS.BLEND_SHAPES,
        toNetworkBlendShapes(blendShapes)
      );
    }
  }, []);

  // Getter for remote blend shapes (returns ref value, doesn't cause re-renders)
  const getRemoteBlendShapes = useCallback(
    (username: string): NetworkBlendShapes | undefined => {
      return remoteBlendShapesRef.current.get(username);
    },
    []
  );

  return {
    isConnected,
    participants,
    error,
    leaveRoom,
    sendBlendShapes,
    getRemoteBlendShapes,
  };
}
