"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { BlendShapes } from "@/lib/blendShapeMapping";
import type { NetworkBlendShapes } from "@/lib/hooks/useRoom";

// Dynamically import AnimatedAvatar with SSR disabled (MediaPipe doesn't work on server)
const AnimatedAvatar = dynamic(
  () => import("./AnimatedAvatar").then((mod) => mod.AnimatedAvatar),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

interface SocketParticipant {
  username: string;
  isDistracted: boolean;
  avatarUrl?: string;
}

interface VideoGridProps {
  participants: SocketParticipant[];
  localUsername: string;
  sendBlendShapes: (blendShapes: BlendShapes) => void;
  getRemoteBlendShapes: (username: string) => NetworkBlendShapes | undefined;
}

// Get avatar URL from localStorage
function getStoredAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("selectedAvatar");
}

export function VideoGrid({
  participants,
  localUsername,
  sendBlendShapes,
  getRemoteBlendShapes,
}: VideoGridProps) {
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setLocalAvatarUrl(getStoredAvatarUrl());
  }, []);

  // Determine grid columns based on participant count
  const getGridCols = (count: number) => {
    if (count <= 1) return "grid-cols-1";
    if (count <= 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-4";
  };

  // Merge socket participants with avatar data
  // For local user, use localStorage avatar (most up-to-date)
  // For remote users, use the avatarUrl from socket (synced from their localStorage)
  const mergedParticipants = participants.map((p) => ({
    ...p,
    avatarUrl: p.username === localUsername ? localAvatarUrl : p.avatarUrl,
    isLocal: p.username === localUsername,
  }));

  console.log("VideoGrid participants:", mergedParticipants);

  return (
    <div className="space-y-4">
      {/* Avatar info bar */}
      <div className="flex items-center justify-center gap-4">
        {!localAvatarUrl && (
          <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-2">
            <span className="text-yellow-400">⚠️</span>
            <span className="text-yellow-200 text-sm">No avatar set</span>
            <Link
              href="/avatar"
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
            >
              Create Avatar
            </Link>
          </div>
        )}
        {localAvatarUrl && (
          <Link
            href="/avatar"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <span>�</span> Change Avatar
          </Link>
        )}
      </div>

      {/* Avatar grid */}
      <div
        className={`grid gap-4 ${getGridCols(
          mergedParticipants.length
        )} max-w-5xl mx-auto`}
      >
        {mergedParticipants.map((participant) => (
          <AvatarParticipantCard
            key={participant.username}
            username={participant.username}
            isDistracted={participant.isDistracted}
            isLocal={participant.isLocal}
            avatarUrl={participant.avatarUrl || null}
            onBlendShapesUpdate={
              participant.isLocal ? sendBlendShapes : undefined
            }
            getRemoteBlendShapes={
              !participant.isLocal ? getRemoteBlendShapes : undefined
            }
          />
        ))}
        {mergedParticipants.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p>Waiting for participants to join...</p>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="text-center">
        <p className="text-gray-500 text-xs">
          🔒 No video is transmitted. Your camera is only used locally for face
          tracking.
        </p>
      </div>
    </div>
  );
}

interface AvatarParticipantCardProps {
  username: string;
  isDistracted: boolean;
  isLocal: boolean;
  avatarUrl: string | null;
  onBlendShapesUpdate?: (blendShapes: BlendShapes) => void;
  getRemoteBlendShapes?: (username: string) => NetworkBlendShapes | undefined;
}

function AvatarParticipantCard({
  username,
  isDistracted,
  isLocal,
  avatarUrl,
  onBlendShapesUpdate,
  getRemoteBlendShapes,
}: AvatarParticipantCardProps) {
  return (
    <div
      className={`relative aspect-video bg-gray-800 rounded-xl overflow-hidden ${
        isLocal ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Avatar or placeholder */}
      {avatarUrl ? (
        <AnimatedAvatar
          avatarUrl={avatarUrl}
          isLocal={isLocal}
          className="absolute inset-0"
          onBlendShapesUpdate={onBlendShapesUpdate}
          remoteUsername={!isLocal ? username : undefined}
          getRemoteBlendShapes={getRemoteBlendShapes}
        />
      ) : (
        /* Placeholder when no avatar */
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl font-bold text-gray-400 mx-auto mb-2">
              {username.charAt(0).toUpperCase()}
            </div>
            <p className="text-gray-500 text-xs mb-1">No Avatar</p>
            {isLocal ? (
              <Link
                href="/avatar"
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                Create avatar →
              </Link>
            ) : (
              <p className="text-gray-600 text-xs">{username}</p>
            )}
          </div>
        </div>
      )}

      {/* Distracted overlay */}
      {isDistracted && (
        <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center z-10">
          <div className="text-center">
            <span className="text-4xl">😴</span>
            <p className="text-white font-medium mt-2">Distracted</p>
          </div>
        </div>
      )}

      {/* Username label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 z-10">
        <p className="text-white text-sm font-medium truncate">
          {username} {isLocal && "(You)"}
        </p>
      </div>

      {/* Focus indicator */}
      {!isDistracted && (
        <div className="absolute top-3 right-3 z-10">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Local user indicator */}
      {isLocal && avatarUrl && (
        <div className="absolute top-3 left-3 z-10">
          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
            Your Avatar
          </span>
        </div>
      )}
    </div>
  );
}
