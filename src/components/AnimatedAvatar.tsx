"use client";

import { useRef, useEffect, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import { initHolisticTracking, HolisticResults } from "@/lib/faceTracking";
import {
  holisticToBlendShapes,
  smoothBlendShapes,
  BlendShapes,
} from "@/lib/blendShapeMapping";
import * as THREE from "three";

// Loading fallback for avatar
function AvatarLoading() {
  return (
    <mesh>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial color="#4b5563" />
    </mesh>
  );
}

// Ready Player Me bone names (face-only mode)
const BONE_NAMES = {
  neck: "Neck",
  head: "Head",
};

interface AvatarProps {
  url: string;
  getBlendShapes: () => BlendShapes | null;
}

function Avatar({ url, getBlendShapes }: AvatarProps) {
  const { scene } = useGLTF(url);
  const avatarRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<Record<string, THREE.Bone>>({});
  const initialRotationsRef = useRef<Record<string, THREE.Euler>>({});
  const resetRotationsRef = useRef<boolean>(false);

  // Reset all rotations when 'R' key is pressed
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "r" || event.key === "R") {
        resetRotationsRef.current = true;
        console.log("Resetting all bone rotations to T-pose");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Find bones and store initial rotations on mount
  useEffect(() => {
    const bones: Record<string, THREE.Bone> = {};
    const initialRotations: Record<string, THREE.Euler> = {};

    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone;
        bones[child.name] = bone;
        initialRotations[child.name] = bone.rotation.clone();
      }
    });

    bonesRef.current = bones;
    initialRotationsRef.current = initialRotations;

    console.log("Found bones:", Object.keys(bones));
  }, [scene]);

  useFrame(() => {
    if (!avatarRef.current) return;

    const bones = bonesRef.current;
    const initRot = initialRotationsRef.current;

    // Check if reset was requested
    if (resetRotationsRef.current) {
      resetRotationsRef.current = false;
      // Reset all bones to initial rotation
      for (const boneName of Object.keys(bones)) {
        if (initRot[boneName]) {
          bones[boneName].rotation.copy(initRot[boneName]);
        }
      }
      // Reset avatar position
      avatarRef.current.position.set(0, -1.9, 0);
      return;
    }

    // Get latest blend shapes (from state for local, from ref for remote)
    const blendShapes = getBlendShapes();
    if (!blendShapes) return;

    // Apply head position (translate the entire avatar based on head movement)
    // Scale factors for position mapping
    const posScale = 0.5; // How much movement translates to avatar movement
    const depthScale = 1.0; // How much depth affects z position

    // Center is 0.5,0.5 in MediaPipe coords
    const headX = -(blendShapes.headPosition.x - 0.5) * posScale;
    const headY = -(blendShapes.headPosition.y - 0.5) * posScale;
    const headZ = -blendShapes.headPosition.z * depthScale; // Depth: negative = closer

    // Apply position to avatar root (subtle movement)
    avatarRef.current.position.x = headX * 0.7;
    avatarRef.current.position.y = -2.0 + headY * 0.2; // Keep base position
    avatarRef.current.position.z = headZ * 0.9 - 0.2;

    // Apply head rotation
    if (bones[BONE_NAMES.head] && initRot[BONE_NAMES.head]) {
      const headBone = bones[BONE_NAMES.head];
      headBone.rotation.x =
        initRot[BONE_NAMES.head].x + blendShapes.headRotationX * 2;
      headBone.rotation.y =
        initRot[BONE_NAMES.head].y - blendShapes.headRotationY * 0.9;
      headBone.rotation.z =
        initRot[BONE_NAMES.head].z + blendShapes.headRotationZ * -0.9;
    }

    // Face-only mode - arms stay in T-pose

    // Apply blend shapes to mesh (Ready Player Me uses ARKit naming)
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;

        // Eye blinks
        if (dict["eyeBlinkLeft"] !== undefined) {
          influences[dict["eyeBlinkLeft"]] = blendShapes.eyeBlinkLeft;
        }
        if (dict["eyeBlinkRight"] !== undefined) {
          influences[dict["eyeBlinkRight"]] = blendShapes.eyeBlinkRight;
        }

        // Jaw/mouth
        if (dict["jawOpen"] !== undefined) {
          influences[dict["jawOpen"]] = blendShapes.jawOpen;
        }

        // Smile
        if (dict["mouthSmileLeft"] !== undefined) {
          influences[dict["mouthSmileLeft"]] = blendShapes.mouthSmile;
        }
        if (dict["mouthSmileRight"] !== undefined) {
          influences[dict["mouthSmileRight"]] = blendShapes.mouthSmile;
        }

        // Alternative naming conventions
        if (dict["viseme_aa"] !== undefined && blendShapes.jawOpen > 0.3) {
          influences[dict["viseme_aa"]] = blendShapes.jawOpen * 0.5;
        }
      }
    });
  });

  return (
    <primitive
      ref={avatarRef}
      object={scene}
      position={[0, -1.9, 0]}
      scale={1.2}
    />
  );
}

// Network blend shapes (face-only mode)
interface NetworkBlendShapes {
  headRotationX: number;
  headRotationY: number;
  headRotationZ: number;
  headPosX: number;
  headPosY: number;
  headPosZ: number;
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  jawOpen: number;
  mouthSmile: number;
}

// Convert network blend shapes to full BlendShapes format
function networkToBlendShapes(nbs: NetworkBlendShapes): BlendShapes {
  return {
    headRotationX: nbs.headRotationX,
    headRotationY: nbs.headRotationY,
    headRotationZ: nbs.headRotationZ,
    headPosition: { x: nbs.headPosX, y: nbs.headPosY, z: nbs.headPosZ },
    eyeBlinkLeft: nbs.eyeBlinkLeft,
    eyeBlinkRight: nbs.eyeBlinkRight,
    jawOpen: nbs.jawOpen,
    mouthSmile: nbs.mouthSmile,
  };
}

interface AnimatedAvatarProps {
  avatarUrl: string;
  isLocal?: boolean;
  className?: string;
  onBlendShapesUpdate?: (blendShapes: BlendShapes) => void;
  onGazeUpdate?: (blendShapes: BlendShapes | null) => void;
  remoteUsername?: string;
  getRemoteBlendShapes?: (username: string) => NetworkBlendShapes | undefined;
}

export function AnimatedAvatar({
  avatarUrl,
  isLocal = false,
  className = "",
  onBlendShapesUpdate,
  onGazeUpdate,
  remoteUsername,
  getRemoteBlendShapes,
}: AnimatedAvatarProps) {
  // Preload avatar as early as possible
  useEffect(() => {
    if (avatarUrl) {
      useGLTF.preload(avatarUrl);
    }
  }, [avatarUrl]);

  const [blendShapes, setBlendShapes] = useState<BlendShapes | null>(null);
  const [holisticResults, setHolisticResults] =
    useState<HolisticResults | null>(null);
  const previousBlendShapesRef = useRef<BlendShapes | null>(null);
  const remoteBlendShapesRef = useRef<BlendShapes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const debugVideoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // For remote users, poll blend shapes from ref (updated by socket, no state changes)
  useEffect(() => {
    if (isLocal || !remoteUsername || !getRemoteBlendShapes) return;

    // Poll at ~20fps for remote blend shapes (matches network send rate)
    const intervalId = setInterval(() => {
      const networkBlendShapes = getRemoteBlendShapes(remoteUsername);
      if (networkBlendShapes) {
        remoteBlendShapesRef.current = networkToBlendShapes(networkBlendShapes);
      }
    }, 50); // 20fps (was 33ms/30fps)

    return () => clearInterval(intervalId);
  }, [isLocal, remoteUsername, getRemoteBlendShapes]);

  // Initialize face tracking only for local user
  useEffect(() => {
    if (!isLocal) return;

    let cleanup: (() => void) | null = null;
    let isMounted = true;

    // Create video element for face tracking (can be shown for debug)
    const video = document.createElement("video");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.style.display = "none"; // Hidden by default, shown via debug ref
    document.body.appendChild(video);
    videoElementRef.current = video;

    // Request camera access - lower resolution for faster processing
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 320 }, // Lower res for speed (was 640)
          height: { ideal: 240 }, // Lower res for speed (was 480)
          facingMode: "user",
          frameRate: { ideal: 24 }, // Match face tracking target fps
        },
      })
      .then(async (stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        video.play();

        // Also set the debug video ref if it exists
        if (debugVideoRef.current) {
          debugVideoRef.current.srcObject = stream;
          debugVideoRef.current.play();
        }

        // Initialize holistic tracking (face + hands + pose)
        cleanup = await initHolisticTracking(
          video,
          (results: HolisticResults) => {
            // Store raw results for debug visualization
            setHolisticResults(results);

            const rawBlendShapes = holisticToBlendShapes(results);
            const smoothed = smoothBlendShapes(
              rawBlendShapes,
              previousBlendShapesRef.current,
              0.3 // Lower smoothing for more responsive 1:1 tracking
            );
            
            // Only update previous ref if we got valid data
            if (smoothed) {
              previousBlendShapesRef.current = smoothed;
            }
            setBlendShapes(smoothed);

            // Send blend shapes to other participants (only if face detected)
            if (onBlendShapesUpdate && smoothed) {
              onBlendShapesUpdate(smoothed);
            }

            // Process gaze for distraction detection
            // IMPORTANT: Always call this, even with null (no face = distracted)
            if (onGazeUpdate) {
              onGazeUpdate(smoothed);
            }
          }
        );
      })
      .catch((err) => {
        console.error("Failed to access camera for face tracking:", err);
        setError("Camera access required for avatar animation");
      });

    return () => {
      isMounted = false;
      cleanup?.();
      videoElementRef.current = null;
      // Stop video stream
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
      video.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal]);

  // Connect debug video when toggled on
  useEffect(() => {
    if (showDebug && debugVideoRef.current && videoElementRef.current) {
      const stream = videoElementRef.current.srcObject as MediaStream;
      if (stream) {
        debugVideoRef.current.srcObject = stream;
        debugVideoRef.current.play().catch(() => {});
      }
    }
  }, [showDebug]);

  // Draw face mesh on debug canvas (face-only mode)
  useEffect(() => {
    if (!showDebug || !debugCanvasRef.current || !holisticResults) return;

    const canvas = debugCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Helper to draw a line between two landmarks
    const drawLine = (
      landmarks: { x: number; y: number }[],
      i1: number,
      i2: number,
      color: string,
      width: number = 2
    ) => {
      if (!landmarks[i1] || !landmarks[i2]) return;
      ctx.beginPath();
      ctx.moveTo(
        landmarks[i1].x * canvas.width,
        landmarks[i1].y * canvas.height
      );
      ctx.lineTo(
        landmarks[i2].x * canvas.width,
        landmarks[i2].y * canvas.height
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    // Draw face mesh only
    if (holisticResults.faceLandmarks) {
      const face = holisticResults.faceLandmarks;
      // Draw face oval
      const faceKeyPoints = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
        379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
        127, 162, 21, 54, 103, 67, 109,
      ];

      ctx.beginPath();
      ctx.moveTo(
        face[faceKeyPoints[0]].x * canvas.width,
        face[faceKeyPoints[0]].y * canvas.height
      );
      for (let i = 1; i < faceKeyPoints.length; i++) {
        ctx.lineTo(
          face[faceKeyPoints[i]].x * canvas.width,
          face[faceKeyPoints[i]].y * canvas.height
        );
      }
      ctx.closePath();
      ctx.strokeStyle = "#ffd93d";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw eyes and mouth
      drawLine(face, 33, 133, "#ffd93d", 1);
      drawLine(face, 159, 145, "#ffd93d", 1);
      drawLine(face, 362, 263, "#ffd93d", 1);
      drawLine(face, 386, 374, "#ffd93d", 1);
      drawLine(face, 61, 291, "#ffd93d", 1);
      drawLine(face, 13, 14, "#ffd93d", 1);

      // Nose tip
      ctx.beginPath();
      ctx.arc(
        face[1].x * canvas.width,
        face[1].y * canvas.height,
        3,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = "#ffd93d";
      ctx.fill();
    }
  }, [showDebug, holisticResults]);

  const handleLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Getter for blend shapes - returns latest from state (local) or ref (remote)
  const getBlendShapes = useCallback((): BlendShapes | null => {
    if (isLocal) {
      return blendShapes;
    } else {
      return remoteBlendShapesRef.current;
    }
  }, [isLocal, blendShapes]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading avatar...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute top-2 left-2 right-2 bg-red-900/80 text-white text-xs p-2 rounded z-20">
          {error}
        </div>
      )}

      {/* Debug toggle button */}
      {isLocal && (
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="absolute top-2 right-2 z-30 bg-gray-700/80 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded"
        >
          {showDebug ? "Hide" : "Debug"}
        </button>
      )}

      {/* Debug preview camera with MediaPipe skeleton overlay */}
      {isLocal && showDebug && (
        <div className="absolute bottom-2 right-2 z-30 w-64 rounded overflow-hidden border border-gray-600 shadow-lg">
          <div className="relative">
            <video
              ref={debugVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-48 object-cover transform scale-x-[-1]"
            />
            <canvas
              ref={debugCanvasRef}
              width={640}
              height={480}
              className="absolute top-0 left-0 w-full h-48 transform scale-x-[-1] pointer-events-none"
            />
          </div>
          <div className="bg-black/90 text-white text-[9px] p-1.5 font-mono space-y-0.5">
            <div className="flex gap-2">
              <span className="text-yellow-400">●</span>
              <span>Face Tracking</span>
            </div>
            <div className="text-green-400">
              Pos: {blendShapes?.headPosition.x.toFixed(2)},{" "}
              {blendShapes?.headPosition.y.toFixed(2)},{" "}
              {blendShapes?.headPosition.z.toFixed(2)}
            </div>
            <div>
              Rot: {blendShapes?.headRotationX.toFixed(2)},{" "}
              {blendShapes?.headRotationY.toFixed(2)},{" "}
              {blendShapes?.headRotationZ.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* 3D Avatar Canvas */}
      <Canvas
        camera={{ position: [0, 0.1, 1.2], fov: 30 }}
        onCreated={handleLoaded}
        style={{ background: "#1f2937" }}
        gl={{ alpha: false }}
      >
        <color attach="background" args={["#1f2937"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, 5]} intensity={0.4} />
        <Suspense fallback={<AvatarLoading />}>
          <Avatar url={avatarUrl} getBlendShapes={getBlendShapes} />
          <Environment preset="apartment" />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload avatar to avoid loading delay
export function preloadAvatar(url: string) {
  useGLTF.preload(url);
}
