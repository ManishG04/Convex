"use client";

import { useTimer } from "@/lib/hooks";

interface TimerDisplayProps {
  isHost?: boolean;
}

export function TimerDisplay({ isHost = false }: TimerDisplayProps) {
  const { formattedTime, isRunning, phase, startTimer, stopTimer } = useTimer();

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 rounded-2xl">
      {/* Phase indicator */}
      <div
        className={`px-4 py-1 rounded-full text-sm font-medium ${
          phase === "focus"
            ? "bg-red-500/20 text-red-400"
            : "bg-green-500/20 text-green-400"
        }`}
      >
        {phase === "focus" ? "🎯 Focus Time" : "☕ Break Time"}
      </div>

      {/* Timer display */}
      <div className="text-7xl font-mono font-bold text-white tabular-nums">
        {formattedTime}
      </div>

      {/* Controls (only for host) */}
      {isHost && (
        <div className="flex gap-3 mt-2">
          {!isRunning ? (
            <button
              onClick={() => startTimer(phase)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Start {phase === "focus" ? "Focus" : "Break"}
            </button>
          ) : (
            <button
              onClick={stopTimer}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Status for non-hosts */}
      {!isHost && isRunning && (
        <p className="text-gray-400 text-sm">Timer controlled by host</p>
      )}
    </div>
  );
}
