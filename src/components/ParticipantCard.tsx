"use client";

interface ParticipantCardProps {
  username: string;
  isDistracted: boolean;
  isLocal?: boolean;
}

export function ParticipantCard({
  username,
  isDistracted,
  isLocal = false,
}: ParticipantCardProps) {
  return (
    <div
      className={`relative aspect-video bg-gray-800 rounded-xl overflow-hidden ${
        isLocal ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Placeholder avatar */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl font-bold text-gray-400">
          {username.charAt(0).toUpperCase()}
        </div>
      </div>

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
    </div>
  );
}
