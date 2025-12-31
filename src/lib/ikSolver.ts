import * as THREE from "three";

/**
 * Simple two-bone IK solver (for arm chains: shoulder -> elbow -> wrist)
 * Uses the law of cosines to calculate joint angles
 */
export class TwoBoneIKSolver {
  private upperBone: THREE.Bone;
  private lowerBone: THREE.Bone;
  private upperLength: number;
  private lowerLength: number;
  private target: THREE.Vector3;
  private poleTarget: THREE.Vector3; // Controls elbow/knee direction

  constructor(
    upperBone: THREE.Bone,
    lowerBone: THREE.Bone,
    upperLength: number,
    lowerLength: number
  ) {
    this.upperBone = upperBone;
    this.lowerBone = lowerBone;
    this.upperLength = upperLength;
    this.lowerLength = lowerLength;
    this.target = new THREE.Vector3();
    this.poleTarget = new THREE.Vector3();
  }

  setTarget(x: number, y: number, z: number) {
    this.target.set(x, y, z);
  }

  setPoleTarget(x: number, y: number, z: number) {
    this.poleTarget.set(x, y, z);
  }

  solve() {
    // Get the root position (shoulder)
    const rootPos = new THREE.Vector3();
    this.upperBone.getWorldPosition(rootPos);

    // Direction to target
    const toTarget = this.target.clone().sub(rootPos);
    const targetDist = toTarget.length();

    // Clamp target distance to reachable range
    const maxReach = this.upperLength + this.lowerLength;
    const minReach = Math.abs(this.upperLength - this.lowerLength);
    const clampedDist = THREE.MathUtils.clamp(
      targetDist,
      minReach + 0.01,
      maxReach - 0.01
    );

    // Calculate elbow angle using law of cosines
    // c² = a² + b² - 2ab*cos(C)
    const cosElbow =
      (this.upperLength ** 2 + this.lowerLength ** 2 - clampedDist ** 2) /
      (2 * this.upperLength * this.lowerLength);
    const elbowAngle = Math.acos(THREE.MathUtils.clamp(cosElbow, -1, 1));

    // Calculate shoulder angle
    const cosShoulder =
      (clampedDist ** 2 + this.upperLength ** 2 - this.lowerLength ** 2) /
      (2 * clampedDist * this.upperLength);
    const shoulderAngle = Math.acos(THREE.MathUtils.clamp(cosShoulder, -1, 1));

    // Get parent inverse matrix for local space calculations
    const parentInverse = new THREE.Matrix4();
    if (this.upperBone.parent) {
      this.upperBone.parent.updateWorldMatrix(true, false);
      parentInverse.copy(this.upperBone.parent.matrixWorld).invert();
    }

    // Convert target to local space
    const localTarget = this.target.clone().applyMatrix4(parentInverse);
    // Pole target for elbow direction (can be used for more advanced IK)
    // const localPole = this.poleTarget.clone().applyMatrix4(parentInverse);

    // Calculate rotation to point at target
    const direction = localTarget.clone().normalize();

    // Create rotation from default arm direction to target direction
    const defaultDir = new THREE.Vector3(1, 0, 0); // Assuming T-pose with arms out
    const quat = new THREE.Quaternion().setFromUnitVectors(
      defaultDir,
      direction
    );

    // Apply shoulder rotation with shoulder angle offset
    const euler = new THREE.Euler().setFromQuaternion(quat);
    euler.z -= shoulderAngle; // Offset by shoulder angle

    this.upperBone.rotation.copy(euler);

    // Apply elbow rotation (simple hinge joint)
    this.lowerBone.rotation.set(0, 0, Math.PI - elbowAngle);
  }
}

/**
 * Converts MediaPipe normalized coordinates to 3D world space
 * MediaPipe: x (0-1, left to right), y (0-1, top to bottom), z (depth, negative = closer)
 */
export function mediaPipeToWorld(
  landmark: { x: number; y: number; z: number },
  scale: number = 1,
  offset: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  return new THREE.Vector3(
    (landmark.x - 0.5) * scale * -1, // Mirror X for avatar
    (0.5 - landmark.y) * scale, // Flip Y (MediaPipe Y is down)
    landmark.z * scale * -1 // Z depth
  ).add(offset);
}

/**
 * Simple quaternion-based arm rotation from shoulder to wrist direction
 */
export function calculateArmRotation(
  shoulderPos: { x: number; y: number; z: number },
  elbowPos: { x: number; y: number; z: number },
  wristPos: { x: number; y: number; z: number },
  isLeft: boolean
): { shoulder: THREE.Euler; elbow: number } {
  // Convert to THREE vectors
  const shoulder = new THREE.Vector3(
    shoulderPos.x,
    shoulderPos.y,
    shoulderPos.z
  );
  const elbow = new THREE.Vector3(elbowPos.x, elbowPos.y, elbowPos.z);
  const wrist = new THREE.Vector3(wristPos.x, wristPos.y, wristPos.z);

  // Upper arm direction (shoulder to elbow)
  const upperArmDir = elbow.clone().sub(shoulder).normalize();

  // Lower arm direction (elbow to wrist)
  const lowerArmDir = wrist.clone().sub(elbow).normalize();

  // Default T-pose direction
  const defaultDir = new THREE.Vector3(isLeft ? -1 : 1, 0, 0);

  // Calculate shoulder rotation
  const shoulderQuat = new THREE.Quaternion().setFromUnitVectors(
    defaultDir,
    upperArmDir
  );
  const shoulderEuler = new THREE.Euler().setFromQuaternion(
    shoulderQuat,
    "XYZ"
  );

  // Calculate elbow angle (dot product of upper and lower arm)
  const elbowAngle = Math.acos(
    THREE.MathUtils.clamp(upperArmDir.dot(lowerArmDir), -1, 1)
  );

  return {
    shoulder: shoulderEuler,
    elbow: elbowAngle,
  };
}

/**
 * Smooth interpolation for rotations
 */
export function lerpEuler(
  current: THREE.Euler,
  target: THREE.Euler,
  alpha: number
): THREE.Euler {
  return new THREE.Euler(
    THREE.MathUtils.lerp(current.x, target.x, alpha),
    THREE.MathUtils.lerp(current.y, target.y, alpha),
    THREE.MathUtils.lerp(current.z, target.z, alpha)
  );
}
