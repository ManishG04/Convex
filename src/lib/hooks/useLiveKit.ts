"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Room,
  RoomEvent,
  VideoPresets,
  Track,
  LocalParticipant,
  RemoteParticipant,
  LocalTrackPublication,
  RemoteTrackPublication,
} from "livekit-client";

interface UseLiveKitOptions {
  roomCode: string;
  username: string;
}

interface ParticipantInfo {
  identity: string;
  videoTrack: Track | null;
  audioTrack: Track | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isLocal: boolean;
}

export function useLiveKit({ roomCode, username }: UseLiveKitOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Fetch token and connect to LiveKit
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

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log("LiveKit connected");
        setIsConnected(true);
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log("LiveKit disconnected");
        setIsConnected(false);
        setParticipants([]);
      });

      newRoom.on(RoomEvent.ParticipantConnected, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackSubscribed, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.LocalTrackPublished, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.LocalTrackUnpublished, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackMuted, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnmuted, () => {
        updateParticipants(newRoom);
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

  // Update participants list
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
    let videoTrack: Track | null = null;
    let audioTrack: Track | null = null;
    let isMuted = true;
    let isCameraOff = true;

    participant.trackPublications.forEach(
      (publication: LocalTrackPublication | RemoteTrackPublication) => {
        if (publication.track) {
          if (publication.kind === Track.Kind.Video) {
            videoTrack = publication.track;
            isCameraOff = publication.isMuted;
          } else if (publication.kind === Track.Kind.Audio) {
            audioTrack = publication.track;
            isMuted = publication.isMuted;
          }
        }
      }
    );

    return {
      identity: participant.identity,
      videoTrack,
      audioTrack,
      isMuted,
      isCameraOff,
      isLocal,
    };
  };

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (!room) return;

    try {
      if (isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(false);
        setIsCameraEnabled(false);
      } else {
        await room.localParticipant.setCameraEnabled(true);
        setIsCameraEnabled(true);
      }
    } catch (err) {
      console.error("Camera toggle error:", err);
      setError("Failed to toggle camera");
    }
  }, [room, isCameraEnabled]);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    if (!room) return;

    try {
      if (isMicEnabled) {
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMicEnabled(false);
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicEnabled(true);
      }
    } catch (err) {
      console.error("Mic toggle error:", err);
      setError("Failed to toggle microphone");
    }
  }, [room, isMicEnabled]);

  // Disconnect from room
  const disconnect = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setIsCameraEnabled(false);
      setIsMicEnabled(false);
      setParticipants([]);
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
    isCameraEnabled,
    isMicEnabled,
    participants,
    error,
    connect,
    disconnect,
    toggleCamera,
    toggleMic,
  };
}
