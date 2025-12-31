"use client";

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HolisticResults {
  faceLandmarks: Landmark[] | null;
  leftHandLandmarks: Landmark[] | null;
  rightHandLandmarks: Landmark[] | null;
  poseLandmarks: Landmark[] | null;
}

// MediaPipe Holistic instance type (dynamically loaded)
interface HolisticInstance {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: HolisticRawResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
}

interface HolisticRawResults {
  faceLandmarks?: Landmark[];
  leftHandLandmarks?: Landmark[];
  rightHandLandmarks?: Landmark[];
  poseLandmarks?: Landmark[];
}

// Dynamically load MediaPipe Holistic (client-side only, no SSR)
async function loadHolistic(): Promise<HolisticInstance> {
  // Dynamic import to avoid SSR issues
  const holisticModule = await import("@mediapipe/holistic");
  const Holistic = holisticModule.Holistic;

  return new Holistic({
    locateFile: (file: string) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`;
    },
  });
}

export async function initHolisticTracking(
  videoElement: HTMLVideoElement,
  onResults: (results: HolisticResults) => void
): Promise<() => void> {
  let animationId: number | null = null;
  let isRunning = true;
  let holistic: HolisticInstance | null = null;

  try {
    // Dynamically load MediaPipe (client-side only)
    holistic = await loadHolistic();

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults((results: HolisticRawResults) => {
      onResults({
        faceLandmarks: results.faceLandmarks
          ? Array.from(results.faceLandmarks)
          : null,
        leftHandLandmarks: results.leftHandLandmarks
          ? Array.from(results.leftHandLandmarks)
          : null,
        rightHandLandmarks: results.rightHandLandmarks
          ? Array.from(results.rightHandLandmarks)
          : null,
        poseLandmarks: results.poseLandmarks
          ? Array.from(results.poseLandmarks)
          : null,
      });
    });
  } catch (error) {
    console.error("Failed to initialize MediaPipe Holistic:", error);
    return () => {};
  }

  async function processFrame() {
    if (!isRunning || !holistic) return;

    if (videoElement.readyState >= 2) {
      try {
        await holistic.send({ image: videoElement });
      } catch {
        // Ignore errors during processing
      }
    }

    animationId = requestAnimationFrame(processFrame);
  }

  videoElement.addEventListener("loadeddata", () => {
    processFrame();
  });

  if (videoElement.readyState >= 2) {
    processFrame();
  }

  return () => {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    try {
      holistic?.close();
    } catch {
      // Ignore cleanup errors
    }
  };
}

// Legacy export for backwards compatibility
export type FaceLandmarks = Landmark;
export async function initFaceTracking(
  videoElement: HTMLVideoElement,
  onResults: (landmarks: Landmark[]) => void
): Promise<() => void> {
  return initHolisticTracking(videoElement, (results) => {
    if (results.faceLandmarks) {
      onResults(results.faceLandmarks);
    }
  });
}
