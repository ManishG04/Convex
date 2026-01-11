"use client";

import { BlendShapes } from "./blendShapeMapping";

export interface GazeState {
  isLookingAway: boolean;
  direction: "center" | "left" | "right" | "up" | "down" | "away" | "no_face";
  confidence: number;
}

// Thresholds for determining if user is looking away
// These are in the normalized range [-1, 1]
const GAZE_THRESHOLDS = {
  // Horizontal rotation threshold (looking left/right)
  horizontalMax: 0.35, // ~25 degrees
  // Vertical rotation threshold (looking up/down)
  verticalMax: 0.3, // ~20 degrees
  // Time in ms before triggering distraction
  distractionDelay: 1500, // 1.5 seconds of looking away
  // Time in ms to wait before marking as focused again
  focusDelay: 500, // 0.5 seconds of looking at screen
  // Time in ms before triggering distraction when no face is detected
  noFaceDelay: 2000, // 2 seconds without face detection
};

// State for tracking gaze over time
let lookAwayStartTime: number | null = null;
let lookAtStartTime: number | null = null;
let noFaceStartTime: number | null = null;
let lastDistractedState = false;

/**
 * Analyzes blend shapes to determine if user is looking away from screen
 * Returns "no_face" direction if no blend shapes (face not detected)
 */
export function analyzeGaze(blendShapes: BlendShapes | null): GazeState {
  // No face detected - user might have turned away completely
  if (!blendShapes) {
    return {
      isLookingAway: true,
      direction: "no_face",
      confidence: 1,
    };
  }

  const { headRotationX, headRotationY } = blendShapes;

  // Calculate if user is looking away based on head rotation
  const isLookingLeft = headRotationY < -GAZE_THRESHOLDS.horizontalMax;
  const isLookingRight = headRotationY > GAZE_THRESHOLDS.horizontalMax;
  const isLookingUp = headRotationX < -GAZE_THRESHOLDS.verticalMax;
  const isLookingDown = headRotationX > GAZE_THRESHOLDS.verticalMax;

  // Determine direction
  let direction: GazeState["direction"] = "center";
  if (isLookingLeft) direction = "left";
  else if (isLookingRight) direction = "right";
  else if (isLookingUp) direction = "up";
  else if (isLookingDown) direction = "down";

  const isCurrentlyLookingAway =
    isLookingLeft || isLookingRight || isLookingUp || isLookingDown;

  // Calculate confidence based on how far they're looking away
  const horizontalDeviation = Math.abs(headRotationY);
  const verticalDeviation = Math.abs(headRotationX);
  const maxDeviation = Math.max(horizontalDeviation, verticalDeviation);
  const confidence = Math.min(maxDeviation / 0.5, 1); // Normalize to 0-1

  if (isCurrentlyLookingAway) {
    direction = "away";
  }

  return {
    isLookingAway: isCurrentlyLookingAway,
    direction,
    confidence,
  };
}

/**
 * Tracks gaze state over time and returns whether user should be marked as distracted
 * Uses time-based hysteresis to avoid flickering
 * Also handles case when no face is detected (user turned away completely)
 */
export function trackGazeDistraction(blendShapes: BlendShapes | null): {
  isDistracted: boolean;
  gazeState: GazeState;
  lookAwayDuration: number;
} {
  const gazeState = analyzeGaze(blendShapes);
  const now = Date.now();

  // Handle no face detected case separately (longer delay)
  if (gazeState.direction === "no_face") {
    lookAtStartTime = null;
    lookAwayStartTime = null;

    if (noFaceStartTime === null) {
      noFaceStartTime = now;
    }

    const noFaceDuration = now - noFaceStartTime;

    // Use longer delay for no-face to avoid false positives during brief tracking loss
    if (noFaceDuration >= GAZE_THRESHOLDS.noFaceDelay) {
      lastDistractedState = true;
      return {
        isDistracted: true,
        gazeState,
        lookAwayDuration: noFaceDuration,
      };
    }

    // Still in grace period
    return {
      isDistracted: lastDistractedState,
      gazeState,
      lookAwayDuration: noFaceDuration,
    };
  }

  // Face is detected, reset no-face timer
  noFaceStartTime = null;

  if (gazeState.isLookingAway) {
    // User is currently looking away
    lookAtStartTime = null;

    if (lookAwayStartTime === null) {
      lookAwayStartTime = now;
    }

    const lookAwayDuration = now - lookAwayStartTime;

    // Only mark as distracted after the delay threshold
    if (lookAwayDuration >= GAZE_THRESHOLDS.distractionDelay) {
      lastDistractedState = true;
      return {
        isDistracted: true,
        gazeState,
        lookAwayDuration,
      };
    }

    // Still in grace period
    return {
      isDistracted: lastDistractedState,
      gazeState,
      lookAwayDuration,
    };
  } else {
    // User is looking at screen
    lookAwayStartTime = null;

    if (lookAtStartTime === null) {
      lookAtStartTime = now;
    }

    const lookAtDuration = now - lookAtStartTime;

    // Only mark as focused after the focus delay threshold
    if (lookAtDuration >= GAZE_THRESHOLDS.focusDelay) {
      lastDistractedState = false;
      return {
        isDistracted: false,
        gazeState,
        lookAwayDuration: 0,
      };
    }

    // Still in grace period, maintain last state
    return {
      isDistracted: lastDistractedState,
      gazeState,
      lookAwayDuration: 0,
    };
  }
}

/**
 * Reset the gaze tracking state (call when user leaves room, etc.)
 */
export function resetGazeTracking(): void {
  lookAwayStartTime = null;
  lookAtStartTime = null;
  noFaceStartTime = null;
  lastDistractedState = false;
}

/**
 * Get the current thresholds (useful for debug UI)
 */
export function getGazeThresholds() {
  return { ...GAZE_THRESHOLDS };
}

/**
 * Update thresholds at runtime (for testing/calibration)
 */
export function setGazeThresholds(
  thresholds: Partial<typeof GAZE_THRESHOLDS>
): void {
  Object.assign(GAZE_THRESHOLDS, thresholds);
}
