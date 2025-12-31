"use client";

import { useState } from "react";
import { JoinForm, TimerDisplay, VideoGrid } from "@/components";
import { useRoom, useDistraction } from "@/lib/hooks";

export default function Home() {
  const [session, setSession] = useState<{
    username: string;
    roomCode: string;
  } | null>(null);

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <JoinForm
          onJoin={(username, roomCode) => setSession({ username, roomCode })}
        />
      </div>
    );
  }

  return <RoomView username={session.username} roomCode={session.roomCode} />;
}

function RoomView({
  username,
  roomCode,
}: {
  username: string;
  roomCode: string;
}) {
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
          onClick={leaveRoom}
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

        {/* Stats placeholder */}
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
