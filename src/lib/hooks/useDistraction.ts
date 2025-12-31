"use client";

import { useEffect, useCallback } from "react";
import { getSocket, SOCKET_EVENTS } from "@/lib/socket";

export function useDistraction() {
  useEffect(() => {
    const socket = getSocket();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("User distracted - tab hidden");
        socket.emit(SOCKET_EVENTS.USER_DISTRACTED);
      } else {
        console.log("User focused - tab visible");
        socket.emit(SOCKET_EVENTS.USER_FOCUSED);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const reportDistracted = useCallback(() => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.USER_DISTRACTED);
  }, []);

  const reportFocused = useCallback(() => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.USER_FOCUSED);
  }, []);

  return { reportDistracted, reportFocused };
}
