"use client";

import { useState, useEffect, use, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { TimerDisplay, VideoGrid } from "@/components";
import { useRoom, useDistraction } from "@/lib/hooks";
import { preloadMediaPipe } from "@/lib/faceTracking";
import Link from "next/link";
import { preloadAvatar } from "@/components/AnimatedAvatar";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

// Safely check localStorage for avatar (avoids hydration mismatch)
function useStoredAvatar(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("selectedAvatar"),
    () => null
  );
}

// Safely check sessionStorage for username
function useStoredUsername(roomCode: string): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(`room_${roomCode}_username`),
    () => null
  );
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);
  const roomCode = code.toUpperCase();

  const avatarUrl = useStoredAvatar();
  const storedUsername = useStoredUsername(roomCode);

  // Local state for when user submits the form (before sessionStorage updates)
  const [submittedUsername, setSubmittedUsername] = useState<string | null>(
    null
  );
  const [inputUsername, setInputUsername] = useState("");

  // Preload MediaPipe early
  useEffect(() => {
    preloadMediaPipe();
  }, []);

  // Preload avatar if available
  useEffect(() => {
    if (avatarUrl) {
      preloadAvatar(avatarUrl);
    }
  }, [avatarUrl]);

  // Use submitted username or stored username
  const username = submittedUsername || storedUsername;

  // Still loading (SSR or initial hydration)
  if (avatarUrl === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // No avatar - show create avatar prompt
  if (!avatarUrl) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto p-8 bg-gray-900 rounded-2xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Join Room:{" "}
            <span className="font-mono text-blue-400">{roomCode}</span>
          </h1>
          <div className="p-4 bg-amber-900/50 border border-amber-600 rounded-lg mb-6">
            <p className="text-amber-200 text-sm mb-3">
              ⚠️ You need to create an avatar before joining.
            </p>
            <Link
              href="/avatar"
              className="block w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-center transition-colors"
            >
              Create Your Avatar →
            </Link>
          </div>
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Need username - show quick join form
  if (!username) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto p-8 bg-gray-900 rounded-2xl shadow-xl">
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Join Room
          </h1>
          <p className="text-gray-400 text-center mb-6">
            Room Code:{" "}
            <span className="font-mono text-blue-400">{roomCode}</span>
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputUsername.trim()) {
                sessionStorage.setItem(
                  `room_${roomCode}_username`,
                  inputUsername.trim()
                );
                setSubmittedUsername(inputUsername.trim());
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!inputUsername.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Join Room
            </button>
          </form>

          <Link
            href="/"
            className="block text-center text-gray-400 hover:text-white text-sm mt-4"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // User has username and avatar - show room
  return <RoomView username={username} roomCode={roomCode} />;
}

function RoomView({
  username,
  roomCode,
}: {
  username: string;
  roomCode: string;
}) {
  const router = useRouter();
  const {
    isConnected,
    participants,
    error,
    leaveRoom,
    sendBlendShapes,
    getRemoteBlendShapes,
  } = useRoom(roomCode, username);

  // Set up distraction detection
  useDistraction();

  const handleLeave = () => {
    sessionStorage.removeItem(`room_${roomCode}_username`);
    leaveRoom();
    router.push("/");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-white">🎯 Convex</h1>
          <p className="text-gray-400 text-sm">
            Room: <span className="font-mono text-white">{roomCode}</span>
            {!isConnected && (
              <span className="ml-2 text-yellow-500">Connecting...</span>
            )}
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Leave Room
        </button>
      </header>

      {/* Main content */}
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Timer */}
        <TimerDisplay isHost={participants[0]?.username === username} />

        {/* Avatar grid */}
        <VideoGrid
          participants={participants}
          localUsername={username}
          sendBlendShapes={sendBlendShapes}
          getRemoteBlendShapes={getRemoteBlendShapes}
        />

        {/* Stats */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Session Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">0</p>
              <p className="text-gray-400 text-sm">Sessions Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">
                {participants.length}
              </p>
              <p className="text-gray-400 text-sm">Participants</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">
                {participants.filter((p) => !p.isDistracted).length}
              </p>
              <p className="text-gray-400 text-sm">Currently Focused</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
