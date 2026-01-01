"use client";

import { useState, useSyncExternalStore, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { preloadAvatar } from "./AnimatedAvatar";

interface JoinFormProps {
  onJoin?: (username: string, roomCode: string) => void;
}

// Use useSyncExternalStore to safely read localStorage (avoids hydration mismatch)
function useHasAvatar(): boolean | null {
  return useSyncExternalStore(
    // Subscribe - localStorage doesn't have events, so no-op
    () => () => {},
    // Get client snapshot
    () => !!localStorage.getItem("selectedAvatar"),
    // Get server snapshot (always null during SSR)
    () => null
  );
}

export function JoinForm({ onJoin }: JoinFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const hasAvatar = useHasAvatar();
  // Track if avatar check was refreshed after form interaction
  // State to force re-check of avatar
  const [noAvatarError, setNoAvatarError] = useState(false);

  // Preload avatar GLB as soon as we know the user has one
  useEffect(() => {
    if (hasAvatar) {
      const avatarUrl = localStorage.getItem("selectedAvatar");
      if (avatarUrl) {
        preloadAvatar(avatarUrl);
      }
    }
  }, [hasAvatar]);

  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    // Re-check avatar before joining
    const avatarUrl = localStorage.getItem("selectedAvatar");
    if (!avatarUrl) {
      setNoAvatarError(true);
      return;
    }

    const code = isCreating
      ? generateRoomCode()
      : roomCode.trim().toUpperCase();
    if (!code) return;

    // Store username in sessionStorage for the room
    sessionStorage.setItem(`room_${code}_username`, username.trim());

    // Call onJoin callback if provided (for backwards compatibility)
    if (onJoin) {
      onJoin(username.trim(), code);
    }

    // Redirect to room URL
    router.push(`/${code}`);
  };

  // Show avatar error if either hook returns false OR if submit found no avatar
  const showNoAvatar = hasAvatar === false || noAvatarError;
  // Disable button while checking avatar status (null) or if no avatar
  const isButtonDisabled = hasAvatar === null || showNoAvatar;

  return (
    <div className="max-w-md mx-auto p-8 bg-gray-900 rounded-2xl shadow-xl">
      <h1 className="text-3xl font-bold text-white text-center mb-2">
        🎯 Convex
      </h1>
      <p className="text-gray-400 text-center mb-8">
        Focus together, achieve more.
      </p>

      {/* Avatar required notice */}
      {showNoAvatar && (
        <div className="mb-6 p-4 bg-amber-900/50 border border-amber-600 rounded-lg">
          <p className="text-amber-200 text-sm mb-3">
            ⚠️ You need to create an avatar before joining a room.
          </p>
          <Link
            href="/avatar"
            className="block w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-center transition-colors"
          >
            Create Your Avatar →
          </Link>
        </div>
      )}

      {/* Avatar ready indicator */}
      {hasAvatar === true && !noAvatarError && (
        <div className="mb-6 p-3 bg-green-900/30 border border-green-700 rounded-lg flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <p className="text-green-300 text-sm">
            Avatar ready!{" "}
            <Link href="/avatar" className="underline hover:text-green-200">
              Change it?
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Your Name
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="flex gap-2 border-b border-gray-700 pb-4">
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              !isCreating
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Join Room
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              isCreating
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Create Room
          </button>
        </div>

        {!isCreating && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-widest text-center text-xl"
              required={!isCreating}
            />
          </div>
        )}

        {isCreating && (
          <p className="text-gray-400 text-sm text-center py-4">
            A new room code will be generated when you click the button below.
          </p>
        )}

        <button
          type="submit"
          disabled={isButtonDisabled}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            isButtonDisabled
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {hasAvatar === null
            ? "Checking..."
            : isCreating
            ? "Create & Join Room"
            : "Join Room"}
        </button>
      </form>
    </div>
  );
}
