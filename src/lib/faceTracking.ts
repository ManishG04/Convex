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

// MediaPipe Holistic instance type
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

// SINGLETON: Cache the Holistic instance to avoid slow re-initialization
let cachedHolistic: HolisticInstance | null = null;
let holisticLoadPromise: Promise<HolisticInstance> | null = null;

// Get or create cached Holistic instance (singleton pattern)
async function getHolistic(): Promise<HolisticInstance> {
  if (cachedHolistic) return cachedHolistic;

  // If already loading, wait for that promise
  if (holisticLoadPromise) return holisticLoadPromise;

  // Start loading
  holisticLoadPromise = (async () => {
    const holisticModule = await import("@mediapipe/holistic");
    const Holistic = holisticModule.Holistic;

    const instance = new Holistic({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`;
      },
    });

    // Pre-configure with optimal settings
    instance.setOptions({
      modelComplexity: 0, // Lite model for speed
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    cachedHolistic = instance;
    return instance;
  })();

  return holisticLoadPromise;
}

// PRELOAD: Call this early to start loading MediaPipe in the background
export function preloadMediaPipe(): void {
  if (typeof window === "undefined") return;
  getHolistic().catch(() => {}); // Fire and forget
}

export async function initHolisticTracking(
  videoElement: HTMLVideoElement,
  onResults: (results: HolisticResults) => void
): Promise<() => void> {
  let animationId: number | null = null;
  let isRunning = true;
  let isProcessing = false;
  let lastFrameTime = 0;
  const targetFps = 24;
  const frameInterval = 1000 / targetFps;

  let holistic: HolisticInstance;

  try {
    // Get cached instance (fast if already loaded)
    holistic = await getHolistic();

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
      isProcessing = false;
    });
  } catch (error) {
    console.error("Failed to initialize MediaPipe Holistic:", error);
    return () => {};
  }

  async function processFrame(timestamp: number) {
    if (!isRunning) return;

    const elapsed = timestamp - lastFrameTime;
    if (
      !isProcessing &&
      elapsed >= frameInterval &&
      videoElement.readyState >= 2
    ) {
      isProcessing = true;
      lastFrameTime = timestamp;
      try {
        await holistic.send({ image: videoElement });
      } catch {
        isProcessing = false;
      }
    }

    animationId = requestAnimationFrame(processFrame);
  }

  videoElement.addEventListener("loadeddata", () => {
    requestAnimationFrame(processFrame);
  });

  if (videoElement.readyState >= 2) {
    requestAnimationFrame(processFrame);
  }

  return () => {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    // NOTE: Don't close holistic - it's cached for reuse
  };
}

// Legacy export
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
