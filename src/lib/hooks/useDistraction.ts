"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { getSocket, SOCKET_EVENTS } from "@/lib/socket";
import {
  trackGazeDistraction,
  resetGazeTracking,
  GazeState,
} from "@/lib/gazeDetection";
import type { BlendShapes } from "@/lib/blendShapeMapping";

export interface DistractionState {
  isDistracted: boolean;
  reason: "focused" | "tab_hidden" | "looking_away" | "no_face";
  gazeState: GazeState | null;
  lookAwayDuration: number;
}

export function useDistraction() {
  const [distractionState, setDistractionState] = useState<DistractionState>({
    isDistracted: false,
    reason: "focused",
    gazeState: null,
    lookAwayDuration: 0,
  });

  // Track if tab is hidden (takes priority over gaze)
  const isTabHiddenRef = useRef(false);
  // Track last sent state to avoid duplicate emissions
  const lastSentDistractedRef = useRef(false);
  // Track when we last received face data
  const lastFaceDataTimeRef = useRef<number>(Date.now());
  // Interval for checking face data timeout
  const faceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle tab visibility changes
  useEffect(() => {
    const socket = getSocket();

    const handleVisibilityChange = () => {
      isTabHiddenRef.current = document.hidden;

      if (document.hidden) {
        console.log("User distracted - tab hidden");
        if (!lastSentDistractedRef.current) {
          socket.emit(SOCKET_EVENTS.USER_DISTRACTED);
          lastSentDistractedRef.current = true;
        }
        setDistractionState((prev) => ({
          ...prev,
          isDistracted: true,
          reason: "tab_hidden",
        }));
      } else {
        console.log("User focused - tab visible");
        // Don't immediately mark as focused - let gaze tracking take over
        // Only mark as focused if gaze is also okay
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Set up periodic check for face data timeout
    faceCheckIntervalRef.current = setInterval(() => {
      // If tab is hidden, don't check face data
      if (isTabHiddenRef.current) return;

      const timeSinceLastFaceData = Date.now() - lastFaceDataTimeRef.current;
      // If we haven't received face data for 500ms, process with null
      if (timeSinceLastFaceData > 500) {
        processGazeInternal(null);
      }
    }, 250); // Check every 250ms

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
      }
      resetGazeTracking();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Internal gaze processing function
  const processGazeInternal = useCallback((blendShapes: BlendShapes | null) => {
    // If tab is hidden, that takes priority
    if (isTabHiddenRef.current) {
      return;
    }

    const { isDistracted, gazeState, lookAwayDuration } =
      trackGazeDistraction(blendShapes);
    const socket = getSocket();

    // Determine reason based on gaze state
    let reason: DistractionState["reason"] = "focused";
    if (isDistracted) {
      reason = gazeState.direction === "no_face" ? "no_face" : "looking_away";
    }

    // Update local state
    setDistractionState({
      isDistracted,
      reason,
      gazeState,
      lookAwayDuration,
    });

    // Emit socket events only when state changes
    if (isDistracted && !lastSentDistractedRef.current) {
      console.log(`User distracted - ${reason}`);
      socket.emit(SOCKET_EVENTS.USER_DISTRACTED);
      lastSentDistractedRef.current = true;
    } else if (!isDistracted && lastSentDistractedRef.current) {
      console.log("User focused - looking at screen");
      socket.emit(SOCKET_EVENTS.USER_FOCUSED);
      lastSentDistractedRef.current = false;
    }
  }, []);

  // Process blend shapes for gaze-based distraction detection
  const processGaze = useCallback((blendShapes: BlendShapes | null) => {
    // Update last face data time when we receive valid data
    if (blendShapes) {
      lastFaceDataTimeRef.current = Date.now();
    }
    processGazeInternal(blendShapes);
  }, [processGazeInternal]);

  const reportDistracted = useCallback(() => {
    const socket = getSocket();
    if (!lastSentDistractedRef.current) {
      socket.emit(SOCKET_EVENTS.USER_DISTRACTED);
      lastSentDistractedRef.current = true;
    }
  }, []);

  const reportFocused = useCallback(() => {
    const socket = getSocket();
    if (lastSentDistractedRef.current) {
      socket.emit(SOCKET_EVENTS.USER_FOCUSED);
      lastSentDistractedRef.current = false;
    }
  }, []);

  return {
    distractionState,
    processGaze,
    reportDistracted,
    reportFocused,
  };
}
