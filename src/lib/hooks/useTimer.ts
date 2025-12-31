"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket, SOCKET_EVENTS, TimerStartEvent } from "@/lib/socket";

interface TimerState {
  isRunning: boolean;
  endTime: number | null;
  phase: "focus" | "break";
  remaining: number; // seconds remaining
}

export function useTimer() {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    endTime: null,
    phase: "focus",
    remaining: 25 * 60,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update remaining time every second
  useEffect(() => {
    if (state.isRunning && state.endTime) {
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.floor((state.endTime! - Date.now()) / 1000)
        );
        setState((prev) => ({ ...prev, remaining }));

        if (remaining <= 0) {
          setState((prev) => ({ ...prev, isRunning: false }));
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [state.isRunning, state.endTime]);

  // Listen for timer events from server
  useEffect(() => {
    const socket = getSocket();

    const handleTimerStarted = (data: TimerStartEvent) => {
      console.log("Timer started:", data);
      setState({
        isRunning: true,
        endTime: data.endTime,
        phase: data.phase,
        remaining: Math.floor((data.endTime - Date.now()) / 1000),
      });
    };

    const handleTimerStopped = () => {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        endTime: null,
      }));
    };

    const handleTimerEnded = () => {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        endTime: null,
        remaining: prev.phase === "focus" ? 5 * 60 : 25 * 60,
        phase: prev.phase === "focus" ? "break" : "focus",
      }));
    };

    socket.on(SOCKET_EVENTS.TIMER_STARTED, handleTimerStarted);
    socket.on(SOCKET_EVENTS.TIMER_STOPPED, handleTimerStopped);
    socket.on(SOCKET_EVENTS.TIMER_ENDED, handleTimerEnded);

    return () => {
      socket.off(SOCKET_EVENTS.TIMER_STARTED, handleTimerStarted);
      socket.off(SOCKET_EVENTS.TIMER_STOPPED, handleTimerStopped);
      socket.off(SOCKET_EVENTS.TIMER_ENDED, handleTimerEnded);
    };
  }, []);

  const startTimer = useCallback((phase: "focus" | "break" = "focus") => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.TIMER_START, { phase });
  }, []);

  const stopTimer = useCallback(() => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.TIMER_STOP);
  }, []);

  return {
    ...state,
    startTimer,
    stopTimer,
    formattedTime: formatTime(state.remaining),
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}
