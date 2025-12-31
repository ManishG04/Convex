"use client";

import { useState } from "react";

interface JoinFormProps {
  onJoin: (username: string, roomCode: string) => void;
}

export function JoinForm({ onJoin }: JoinFormProps) {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

    const code = isCreating
      ? generateRoomCode()
      : roomCode.trim().toUpperCase();
    if (!code) return;

    onJoin(username.trim(), code);
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-gray-900 rounded-2xl shadow-xl">
      <h1 className="text-3xl font-bold text-white text-center mb-2">
        🎯 Convex
      </h1>
      <p className="text-gray-400 text-center mb-8">
        Focus together, achieve more.
      </p>

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
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          {isCreating ? "Create & Join Room" : "Join Room"}
        </button>
      </form>
    </div>
  );
}
