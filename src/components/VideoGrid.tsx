"use client";

import { useEffect, useRef } from "react";
import { Track } from "livekit-client";

interface SocketParticipant {
  username: string;
  isDistracted: boolean;
}

interface LiveKitParticipant {
  identity: string;
  videoTrack: Track | null;
  audioTrack: Track | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isLocal: boolean;
}

interface VideoGridProps {
  participants: SocketParticipant[];
  localUsername: string;
  liveKitParticipants?: LiveKitParticipant[];
  isCameraEnabled?: boolean;
  isMicEnabled?: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
  isLiveKitConnected?: boolean;
  onConnectLiveKit?: () => void;
  isLiveKitConfigured?: boolean | null;
}

export function VideoGrid({
  participants,
  localUsername,
  liveKitParticipants = [],
  isCameraEnabled = false,
  isMicEnabled = false,
  onToggleCamera,
  onToggleMic,
  isLiveKitConnected = false,
  onConnectLiveKit,
  isLiveKitConfigured,
}: VideoGridProps) {
  // Determine grid columns based on participant count
  const getGridCols = (count: number) => {
    if (count <= 1) return "grid-cols-1";
    if (count <= 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-4";
  };

  // Merge socket participants with LiveKit video data
  const mergedParticipants = participants.map((p) => {
    const lkParticipant = liveKitParticipants.find(
      (lk) => lk.identity === p.username
    );
    return {
      ...p,
      videoTrack: lkParticipant?.videoTrack || null,
      audioTrack: lkParticipant?.audioTrack || null,
      isCameraOff: lkParticipant?.isCameraOff ?? true,
      isMuted: lkParticipant?.isMuted ?? true,
    };
  });

  return (
    <div className="space-y-4">
      {/* Camera controls */}
      <div className="flex items-center justify-center gap-4">
        {isLiveKitConfigured === false && (
          <p className="text-gray-500 text-sm">
            Video not configured. Add LiveKit credentials to .env to enable.
          </p>
        )}
        {isLiveKitConfigured === null && onConnectLiveKit && (
          <button
            onClick={onConnectLiveKit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <span>📹</span> Enable Video
          </button>
        )}
        {isLiveKitConnected && (
          <>
            <button
              onClick={onToggleCamera}
              className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                isCameraEnabled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
            >
              {isCameraEnabled ? "📹" : "📷"}{" "}
              {isCameraEnabled ? "Camera On" : "Camera Off"}
            </button>
            <button
              onClick={onToggleMic}
              className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                isMicEnabled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
            >
              {isMicEnabled ? "🎙️" : "🔇"} {isMicEnabled ? "Mic On" : "Mic Off"}
            </button>
          </>
        )}
      </div>

      {/* Video grid */}
      <div
        className={`grid gap-4 ${getGridCols(
          mergedParticipants.length
        )} max-w-5xl mx-auto`}
      >
        {mergedParticipants.map((participant) => (
          <VideoParticipantCard
            key={participant.username}
            username={participant.username}
            isDistracted={participant.isDistracted}
            isLocal={participant.username === localUsername}
            videoTrack={participant.videoTrack}
            isCameraOff={participant.isCameraOff}
          />
        ))}
        {mergedParticipants.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p>Waiting for participants to join...</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface VideoParticipantCardProps {
  username: string;
  isDistracted: boolean;
  isLocal: boolean;
  videoTrack: Track | null;
  isCameraOff: boolean;
}

function VideoParticipantCard({
  username,
  isDistracted,
  isLocal,
  videoTrack,
  isCameraOff,
}: VideoParticipantCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && videoTrack) {
      videoTrack.attach(videoElement);
      return () => {
        videoTrack.detach(videoElement);
      };
    }
  }, [videoTrack]);

  return (
    <div
      className={`relative aspect-video bg-gray-800 rounded-xl overflow-hidden ${
        isLocal ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Video element */}
      {videoTrack && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        /* Placeholder avatar when no video */
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl font-bold text-gray-400">
            {username.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Distracted overlay */}
      {isDistracted && (
        <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl">😴</span>
            <p className="text-white font-medium mt-2">Distracted</p>
          </div>
        </div>
      )}

      {/* Username label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-white text-sm font-medium truncate">
          {username} {isLocal && "(You)"}
        </p>
      </div>

      {/* Focus indicator */}
      {!isDistracted && (
        <div className="absolute top-3 right-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Camera off indicator */}
      {isCameraOff && !isDistracted && (
        <div className="absolute top-3 left-3">
          <span className="text-gray-400">📷</span>
        </div>
      )}
    </div>
  );
}
