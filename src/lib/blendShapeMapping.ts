import { HolisticResults } from "./faceTracking";

// 3D position type
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Face-only blend shapes
export interface BlendShapes {
  // Face
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  jawOpen: number;
  mouthSmile: number;
  // Head rotation (radians)
  headRotationX: number;
  headRotationY: number;
  headRotationZ: number;
  // Head position (normalized, with depth)
  headPosition: Vec3;
}

// MediaPipe Face Mesh landmark indices (468 points)
const FACE_INDICES = {
  leftEye: { top: 159, bottom: 145 },
  rightEye: { top: 386, bottom: 374 },
  mouth: { top: 13, bottom: 14, left: 61, right: 291 },
  nose: 1,
  leftCheek: 234,
  rightCheek: 454,
  forehead: 10,
  chin: 152,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function holisticToBlendShapes(results: HolisticResults): BlendShapes {
  const blendShapes: BlendShapes = {
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    jawOpen: 0,
    mouthSmile: 0,
    headRotationX: 0,
    headRotationY: 0,
    headRotationZ: 0,
    headPosition: { x: 0.5, y: 0.5, z: 0 },
  };

  // Process face landmarks only
  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    const face = results.faceLandmarks;
    const {
      leftEye,
      rightEye,
      mouth,
      nose,
      leftCheek,
      rightCheek,
      forehead,
      chin,
    } = FACE_INDICES;

    // Eye blinks - measure vertical eye opening
    const leftEyeDistance = Math.abs(
      face[leftEye.top].y - face[leftEye.bottom].y
    );
    const rightEyeDistance = Math.abs(
      face[rightEye.top].y - face[rightEye.bottom].y
    );
    // Higher multiplier = more sensitive to blinks
    blendShapes.eyeBlinkLeft = clamp(1 - leftEyeDistance * 40, 0, 1);
    blendShapes.eyeBlinkRight = clamp(1 - rightEyeDistance * 40, 0, 1);

    // Mouth
    const mouthOpenDistance = Math.abs(
      face[mouth.top].y - face[mouth.bottom].y
    );
    blendShapes.jawOpen = clamp(mouthOpenDistance * 8, 0, 1);

    const mouthWidth = Math.abs(face[mouth.left].x - face[mouth.right].x);
    blendShapes.mouthSmile = clamp((mouthWidth - 0.12) * 3, 0, 1);

    // Head rotation
    const nosePoint = face[nose];
    const leftCheekPoint = face[leftCheek];
    const rightCheekPoint = face[rightCheek];
    const foreheadPoint = face[forehead];
    const chinPoint = face[chin];

    blendShapes.headRotationY = clamp((nosePoint.x - 0.5) * 2, -1, 1);
    const faceVerticalCenter = (foreheadPoint.y + chinPoint.y) / 2;
    blendShapes.headRotationX = clamp(
      (nosePoint.y - faceVerticalCenter) * 3,
      -1,
      1
    );
    blendShapes.headRotationZ = clamp(
      (leftCheekPoint.y - rightCheekPoint.y) * 2,
      -1,
      1
    );

    // Head position tracking (using nose as center point)
    blendShapes.headPosition = {
      x: nosePoint.x,
      y: nosePoint.y,
      z: nosePoint.z,
    };
  }

  return blendShapes;
}

// Smooth blend shapes to reduce jitter
export function smoothBlendShapes(
  current: BlendShapes,
  previous: BlendShapes | null,
  factor: number = 0.3
): BlendShapes {
  if (!previous) return current;

  return {
    eyeBlinkLeft: lerp(previous.eyeBlinkLeft, current.eyeBlinkLeft, factor),
    eyeBlinkRight: lerp(previous.eyeBlinkRight, current.eyeBlinkRight, factor),
    jawOpen: lerp(previous.jawOpen, current.jawOpen, factor),
    mouthSmile: lerp(previous.mouthSmile, current.mouthSmile, factor),
    headRotationX: lerp(previous.headRotationX, current.headRotationX, factor),
    headRotationY: lerp(previous.headRotationY, current.headRotationY, factor),
    headRotationZ: lerp(previous.headRotationZ, current.headRotationZ, factor),
    headPosition: lerpVec3(previous.headPosition, current.headPosition, factor),
  };
}
