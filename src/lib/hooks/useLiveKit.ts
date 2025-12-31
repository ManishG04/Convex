"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Room,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant,
} from "livekit-client";

/**
 * LiveKit hook for data-only communication (no video/audio)
 *
 * IMPORTANT: Raw video feeds are NOT transmitted for privacy.
 * This hook is used only for:
 * - Room presence (who's connected)
 * - Data channel messages (for syncing avatar blend shapes)
 *
 * Each user's camera is accessed LOCALLY only for face tracking,
 * and only the animated avatar is displayed to other participants.
 */

interface UseLiveKitOptions {
  roomCode: string;
  username: string;
}

interface ParticipantInfo {
  identity: string;
  isLocal: boolean;
  metadata?: string;
}

// Blend shape data structure for avatar sync
export interface BlendShapeData {
  headRotationX: number;
  headRotationY: number;
  headRotationZ: number;
  headPositionX: number;
  headPositionY: number;
  headPositionZ: number;
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  jawOpen: number;
  mouthSmile: number;
}

export function useLiveKit({ roomCode, username }: UseLiveKitOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [remoteBlendShapes, setRemoteBlendShapes] = useState<
    Map<string, BlendShapeData>
  >(new Map());

  // Fetch token and connect to LiveKit (data-only mode)
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Get token from our API
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, username }),
      });

      const data = await res.json();

      if (!data.configured) {
        setIsConfigured(false);
        setIsConnecting(false);
        return;
      }

      setIsConfigured(true);

      // Create room without video/audio capture settings
      const newRoom = new Room({
        adaptiveStream: false,
        dynacast: false,
      });

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log("LiveKit connected (data-only mode)");
        setIsConnected(true);
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log("LiveKit disconnected");
        setIsConnected(false);
        setParticipants([]);
        setRemoteBlendShapes(new Map());
      });

      newRoom.on(RoomEvent.ParticipantConnected, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        updateParticipants(newRoom);
        // Clean up blend shapes for disconnected participant
        setRemoteBlendShapes((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
      });

      // Listen for data messages (avatar blend shapes from other participants)
      newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
        if (!participant) return;
        try {
          const decoder = new TextDecoder();
          const data = JSON.parse(decoder.decode(payload)) as BlendShapeData;
          setRemoteBlendShapes((prev) => {
            const next = new Map(prev);
            next.set(participant.identity, data);
            return next;
          });
        } catch {
          // Ignore invalid data
        }
      });

      await newRoom.connect(data.url, data.token);
      setRoom(newRoom);
    } catch (err) {
      console.error("LiveKit connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, username, isConnecting, isConnected]);

  // Update participants list (identities only, no video/audio tracks)
  const updateParticipants = (currentRoom: Room) => {
    const allParticipants: ParticipantInfo[] = [];

    // Add local participant
    const local = currentRoom.localParticipant;
    allParticipants.push(getParticipantInfo(local, true));

    // Add remote participants
    currentRoom.remoteParticipants.forEach((participant) => {
      allParticipants.push(getParticipantInfo(participant, false));
    });

    setParticipants(allParticipants);
  };

  const getParticipantInfo = (
    participant: LocalParticipant | RemoteParticipant,
    isLocal: boolean
  ): ParticipantInfo => {
    return {
      identity: participant.identity,
      isLocal,
      metadata: participant.metadata,
    };
  };

  // Send blend shapes to other participants via data channel
  const sendBlendShapes = useCallback(
    (blendShapes: BlendShapeData) => {
      if (!room || !isConnected) return;

      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(blendShapes));
        room.localParticipant.publishData(data, { reliable: false });
      } catch {
        // Ignore errors (e.g., if not connected)
      }
    },
    [room, isConnected]
  );

  // Disconnect from room
  const disconnect = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
      setRemoteBlendShapes(new Map());
    }
  }, [room]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    room,
    isConnected,
    isConnecting,
    isConfigured,
    participants,
    error,
    connect,
    disconnect,
    sendBlendShapes,
    remoteBlendShapes,
  };
}
