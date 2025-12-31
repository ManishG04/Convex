import { Landmark, HolisticResults } from "./faceTracking";

// 3D position type
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

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
  // Arms/Shoulders (from pose)
  leftShoulderRotation: Vec3;
  rightShoulderRotation: Vec3;
  leftElbowAngle: number;
  rightElbowAngle: number;
  // Hands
  leftHandOpen: number;
  rightHandOpen: number;
  leftHandRotation: Vec3;
  rightHandRotation: Vec3;
  // Raw landmark positions for IK (normalized 0-1)
  landmarks: {
    leftShoulder: Vec3 | null;
    leftElbow: Vec3 | null;
    leftWrist: Vec3 | null;
    rightShoulder: Vec3 | null;
    rightElbow: Vec3 | null;
    rightWrist: Vec3 | null;
    leftHip: Vec3 | null;
    rightHip: Vec3 | null;
    nose: Vec3 | null; // For head position tracking
  };
}

// MediaPipe Face Mesh landmark indices (468 points in Holistic face)
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

// MediaPipe Pose landmark indices (33 points)
const POSE_INDICES = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
};

// MediaPipe Hand landmark indices (21 points per hand)
const HAND_INDICES = {
  wrist: 0,
  thumbTip: 4,
  indexTip: 8,
  middleTip: 12,
  ringTip: 16,
  pinkyTip: 20,
  indexMcp: 5,
  middleMcp: 9,
  ringMcp: 13,
  pinkyMcp: 17,
};

function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dotProduct = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magnitudeBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magnitudeBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

  if (magnitudeBA === 0 || magnitudeBC === 0) return 0;

  const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
  return Math.acos(clamp(cosAngle, -1, 1));
}

function calculateHandOpenness(handLandmarks: Landmark[]): number {
  // Calculate average distance from fingertips to wrist
  const wrist = handLandmarks[HAND_INDICES.wrist];
  const tips = [
    handLandmarks[HAND_INDICES.thumbTip],
    handLandmarks[HAND_INDICES.indexTip],
    handLandmarks[HAND_INDICES.middleTip],
    handLandmarks[HAND_INDICES.ringTip],
    handLandmarks[HAND_INDICES.pinkyTip],
  ];

  let totalDist = 0;
  for (const tip of tips) {
    const dist = Math.sqrt(
      (tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2 + (tip.z - wrist.z) ** 2
    );
    totalDist += dist;
  }

  // Normalize: closed fist ~0.15, open hand ~0.4
  const avgDist = totalDist / 5;
  return clamp((avgDist - 0.1) / 0.3, 0, 1);
}

function calculateHandRotation(handLandmarks: Landmark[]): {
  x: number;
  y: number;
  z: number;
} {
  const wrist = handLandmarks[HAND_INDICES.wrist];
  const middleMcp = handLandmarks[HAND_INDICES.middleMcp];
  const indexMcp = handLandmarks[HAND_INDICES.indexMcp];

  // Direction from wrist to middle finger base
  const forward = {
    x: middleMcp.x - wrist.x,
    y: middleMcp.y - wrist.y,
    z: middleMcp.z - wrist.z,
  };

  // Approximate rotation based on hand orientation
  // Negate Y component to fix vertical inversion (MediaPipe Y increases downward)
  return {
    x: -Math.atan2(forward.y, Math.sqrt(forward.x ** 2 + forward.z ** 2)),
    y: Math.atan2(forward.x, forward.z),
    z: -Math.atan2(indexMcp.y - wrist.y, indexMcp.x - wrist.x),
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
    headPosition: { x: 0, y: 0, z: 0 },
    leftShoulderRotation: { x: 0, y: 0, z: 0 },
    rightShoulderRotation: { x: 0, y: 0, z: 0 },
    leftElbowAngle: 0,
    rightElbowAngle: 0,
    leftHandOpen: 0,
    rightHandOpen: 0,
    leftHandRotation: { x: 0, y: 0, z: 0 },
    rightHandRotation: { x: 0, y: 0, z: 0 },
    landmarks: {
      leftShoulder: null,
      leftElbow: null,
      leftWrist: null,
      rightShoulder: null,
      rightElbow: null,
      rightWrist: null,
      leftHip: null,
      rightHip: null,
      nose: null,
    },
  };

  // Process face landmarks
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

    // Eye blinks
    const leftEyeDistance = Math.abs(
      face[leftEye.top].y - face[leftEye.bottom].y
    );
    const rightEyeDistance = Math.abs(
      face[rightEye.top].y - face[rightEye.bottom].y
    );
    blendShapes.eyeBlinkLeft = 1 - clamp(leftEyeDistance * 15, 0, 1);
    blendShapes.eyeBlinkRight = 1 - clamp(rightEyeDistance * 15, 0, 1);

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
    // X: left-right position (0-1, mirrored)
    // Y: up-down position (0-1, inverted)
    // Z: depth (negative = closer to camera)
    blendShapes.headPosition = {
      x: nosePoint.x,
      y: nosePoint.y,
      z: nosePoint.z,
    };

    // Store nose landmark for reference
    blendShapes.landmarks.nose = {
      x: nosePoint.x,
      y: nosePoint.y,
      z: nosePoint.z,
    };
  }

  // Process pose landmarks (arms/shoulders)
  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    const pose = results.poseLandmarks;

    // Left arm - direct angle calculation for 1:1 mapping
    const leftShoulder = pose[POSE_INDICES.leftShoulder];
    const leftElbow = pose[POSE_INDICES.leftElbow];
    const leftWrist = pose[POSE_INDICES.leftWrist];

    // Store raw landmarks for IK
    blendShapes.landmarks.leftShoulder = {
      x: leftShoulder.x,
      y: leftShoulder.y,
      z: leftShoulder.z,
    };
    blendShapes.landmarks.leftElbow = {
      x: leftElbow.x,
      y: leftElbow.y,
      z: leftElbow.z,
    };
    blendShapes.landmarks.leftWrist = {
      x: leftWrist.x,
      y: leftWrist.y,
      z: leftWrist.z,
    };

    // Calculate arm direction vector (shoulder to elbow)
    const leftArmDir = {
      x: leftElbow.x - leftShoulder.x,
      y: leftElbow.y - leftShoulder.y,
      z: leftElbow.z - leftShoulder.z,
    };

    // Direct rotation angles from arm direction
    // X rotation: arm raise/lower (pitch) - based on vertical angle
    // Y rotation: arm forward/back
    // Z rotation: arm out to side
    blendShapes.leftShoulderRotation = {
      x: Math.atan2(
        -leftArmDir.y,
        Math.sqrt(leftArmDir.x ** 2 + leftArmDir.z ** 2)
      ),
      y: Math.atan2(leftArmDir.z, leftArmDir.x),
      z: Math.atan2(leftArmDir.x, -leftArmDir.y),
    };

    // Calculate elbow angle (full angle, not clamped)
    blendShapes.leftElbowAngle = calculateAngle(
      leftShoulder,
      leftElbow,
      leftWrist
    );

    // Right arm - direct angle calculation for 1:1 mapping
    const rightShoulder = pose[POSE_INDICES.rightShoulder];
    const rightElbow = pose[POSE_INDICES.rightElbow];
    const rightWrist = pose[POSE_INDICES.rightWrist];

    // Store raw landmarks for IK
    blendShapes.landmarks.rightShoulder = {
      x: rightShoulder.x,
      y: rightShoulder.y,
      z: rightShoulder.z,
    };
    blendShapes.landmarks.rightElbow = {
      x: rightElbow.x,
      y: rightElbow.y,
      z: rightElbow.z,
    };
    blendShapes.landmarks.rightWrist = {
      x: rightWrist.x,
      y: rightWrist.y,
      z: rightWrist.z,
    };

    // Also store hips for reference
    blendShapes.landmarks.leftHip = {
      x: pose[POSE_INDICES.leftHip].x,
      y: pose[POSE_INDICES.leftHip].y,
      z: pose[POSE_INDICES.leftHip].z,
    };
    blendShapes.landmarks.rightHip = {
      x: pose[POSE_INDICES.rightHip].x,
      y: pose[POSE_INDICES.rightHip].y,
      z: pose[POSE_INDICES.rightHip].z,
    };

    const rightArmDir = {
      x: rightElbow.x - rightShoulder.x,
      y: rightElbow.y - rightShoulder.y,
      z: rightElbow.z - rightShoulder.z,
    };

    blendShapes.rightShoulderRotation = {
      x: Math.atan2(
        -rightArmDir.y,
        Math.sqrt(rightArmDir.x ** 2 + rightArmDir.z ** 2)
      ),
      y: Math.atan2(rightArmDir.z, -rightArmDir.x),
      z: Math.atan2(-rightArmDir.x, -rightArmDir.y),
    };

    blendShapes.rightElbowAngle = calculateAngle(
      rightShoulder,
      rightElbow,
      rightWrist
    );
  }

  // Process hand landmarks
  if (results.leftHandLandmarks && results.leftHandLandmarks.length > 0) {
    blendShapes.leftHandOpen = calculateHandOpenness(results.leftHandLandmarks);
    blendShapes.leftHandRotation = calculateHandRotation(
      results.leftHandLandmarks
    );
  }

  if (results.rightHandLandmarks && results.rightHandLandmarks.length > 0) {
    blendShapes.rightHandOpen = calculateHandOpenness(
      results.rightHandLandmarks
    );
    blendShapes.rightHandRotation = calculateHandRotation(
      results.rightHandLandmarks
    );
  }

  return blendShapes;
}

// Legacy function for backwards compatibility
export function landmarksToBlendShapes(landmarks: Landmark[]): BlendShapes {
  return holisticToBlendShapes({
    faceLandmarks: landmarks,
    leftHandLandmarks: null,
    rightHandLandmarks: null,
    poseLandmarks: null,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number
): { x: number; y: number; z: number } {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
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
    leftShoulderRotation: lerpVec3(
      previous.leftShoulderRotation,
      current.leftShoulderRotation,
      factor
    ),
    rightShoulderRotation: lerpVec3(
      previous.rightShoulderRotation,
      current.rightShoulderRotation,
      factor
    ),
    leftElbowAngle: lerp(
      previous.leftElbowAngle,
      current.leftElbowAngle,
      factor
    ),
    rightElbowAngle: lerp(
      previous.rightElbowAngle,
      current.rightElbowAngle,
      factor
    ),
    leftHandOpen: lerp(previous.leftHandOpen, current.leftHandOpen, factor),
    rightHandOpen: lerp(previous.rightHandOpen, current.rightHandOpen, factor),
    leftHandRotation: lerpVec3(
      previous.leftHandRotation,
      current.leftHandRotation,
      factor
    ),
    rightHandRotation: lerpVec3(
      previous.rightHandRotation,
      current.rightHandRotation,
      factor
    ),
    // Smooth landmarks for IK
    landmarks: {
      leftShoulder:
        current.landmarks.leftShoulder && previous.landmarks.leftShoulder
          ? lerpVec3(
              previous.landmarks.leftShoulder,
              current.landmarks.leftShoulder,
              factor
            )
          : current.landmarks.leftShoulder,
      leftElbow:
        current.landmarks.leftElbow && previous.landmarks.leftElbow
          ? lerpVec3(
              previous.landmarks.leftElbow,
              current.landmarks.leftElbow,
              factor
            )
          : current.landmarks.leftElbow,
      leftWrist:
        current.landmarks.leftWrist && previous.landmarks.leftWrist
          ? lerpVec3(
              previous.landmarks.leftWrist,
              current.landmarks.leftWrist,
              factor
            )
          : current.landmarks.leftWrist,
      rightShoulder:
        current.landmarks.rightShoulder && previous.landmarks.rightShoulder
          ? lerpVec3(
              previous.landmarks.rightShoulder,
              current.landmarks.rightShoulder,
              factor
            )
          : current.landmarks.rightShoulder,
      rightElbow:
        current.landmarks.rightElbow && previous.landmarks.rightElbow
          ? lerpVec3(
              previous.landmarks.rightElbow,
              current.landmarks.rightElbow,
              factor
            )
          : current.landmarks.rightElbow,
      rightWrist:
        current.landmarks.rightWrist && previous.landmarks.rightWrist
          ? lerpVec3(
              previous.landmarks.rightWrist,
              current.landmarks.rightWrist,
              factor
            )
          : current.landmarks.rightWrist,
      leftHip:
        current.landmarks.leftHip && previous.landmarks.leftHip
          ? lerpVec3(
              previous.landmarks.leftHip,
              current.landmarks.leftHip,
              factor
            )
          : current.landmarks.leftHip,
      rightHip:
        current.landmarks.rightHip && previous.landmarks.rightHip
          ? lerpVec3(
              previous.landmarks.rightHip,
              current.landmarks.rightHip,
              factor
            )
          : current.landmarks.rightHip,
      nose:
        current.landmarks.nose && previous.landmarks.nose
          ? lerpVec3(previous.landmarks.nose, current.landmarks.nose, factor)
          : current.landmarks.nose,
    },
  };
}
