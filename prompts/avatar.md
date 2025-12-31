# Avatar System Implementation Guide

Instructions to implement avatar creation and real-time facial tracking for the Convex focus platform.

## Overview

Replace video camera feeds with animated 3D avatars that mirror user expressions in real-time.

**Flow:**

1. User uploads a selfie → Generate stylized 3D avatar
2. User's webcam tracks facial expressions → Avatar mirrors them live
3. Avatar shown in video rooms instead of raw video feed

---

## Part 1: Avatar Creation (Ready Player Me)

### Why Ready Player Me?

- Converts selfie to rigged `.glb` automatically
- Stylized look (Fortnite/Pixar style)
- Free for developers
- Includes skeleton rig + blend shapes for expressions

### Installation

```bash
pnpm add @readyplayerme/react-avatar-creator
```

### Setup Requirements

1. **Get a subdomain** (required for photo upload to work):

   - Go to https://studio.readyplayer.me/
   - Sign up for a free developer account
   - Create an application
   - Get your subdomain (e.g., `"yourapp"`)

2. **Clear browser cache** if photo upload skips:
   - DevTools (F12) → Application → Storage
   - Delete cookies/localStorage/sessionStorage for `readyplayer.me`

### Avatar Creator Component

Create `src/components/AvatarCreator.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { AvatarCreator } from "@readyplayerme/react-avatar-creator";

interface SavedAvatar {
  url: string;
  createdAt: string;
}

export default function AvatarPage() {
  const [avatars, setAvatars] = useState<SavedAvatar[]>([]);
  const [showCreator, setShowCreator] = useState(true);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [creatorKey, setCreatorKey] = useState(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem("savedAvatars");
    if (saved) setAvatars(JSON.parse(saved));
  }, []);

  const handleAvatarExported = (event: { data: { url: string } }) => {
    const newAvatar: SavedAvatar = {
      url: event.data.url,
      createdAt: new Date().toISOString(),
    };
    const updated = [...avatars, newAvatar];
    setAvatars(updated);
    localStorage.setItem("savedAvatars", JSON.stringify(updated));
    setShowCreator(false);
    setGender(null);
  };

  const deleteAvatar = (index: number) => {
    const updated = avatars.filter((_, i) => i !== index);
    setAvatars(updated);
    localStorage.setItem("savedAvatars", JSON.stringify(updated));
  };

  const startNewAvatar = () => {
    setCreatorKey(Date.now());
    setShowCreator(true);
    setGender(null);
  };

  // Gender selection screen
  if (showCreator && !gender) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "2rem",
        }}
      >
        <h2>Select Avatar Type</h2>
        <div style={{ display: "flex", gap: "2rem" }}>
          <button
            onClick={() => setGender("male")}
            style={{
              padding: "2rem 3rem",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
          >
            👨 Male
          </button>
          <button
            onClick={() => setGender("female")}
            style={{
              padding: "2rem 3rem",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
          >
            👩 Female
          </button>
        </div>
        {avatars.length > 0 && (
          <button onClick={() => setShowCreator(false)}>
            View Saved Avatars
          </button>
        )}
      </div>
    );
  }

  // Avatar creator
  if (showCreator && gender) {
    return (
      <div style={{ width: "100%", height: "100vh" }}>
        <AvatarCreator
          key={creatorKey}
          subdomain="YOUR_SUBDOMAIN" // Replace with your Ready Player Me subdomain
          config={{
            clearCache: true,
            bodyType: "fullbody",
            quickStart: false,
            gender: gender,
          }}
          style={{ width: "100%", height: "100%" }}
          onAvatarExported={handleAvatarExported}
        />
      </div>
    );
  }

  // Saved avatars gallery
  return (
    <div style={{ padding: "2rem" }}>
      <button onClick={startNewAvatar} style={{ marginBottom: "1rem" }}>
        + Create New Avatar
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {avatars.map((avatar, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <img
              src={`${avatar.url.replace(".glb", ".png")}`}
              alt="Avatar preview"
              style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }}
            />
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              {new Date(avatar.createdAt).toLocaleDateString()}
            </p>
            <div
              style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
            >
              <a
                href={avatar.url}
                download
                style={{ flex: 1, textAlign: "center" }}
              >
                Download .glb
              </a>
              <button onClick={() => deleteAvatar(index)} style={{ flex: 1 }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Part 2: Real-Time Facial Tracking (Avatar Mirrors User)

### Goal

User's webcam → Detect facial expressions → Animate the `.glb` avatar in real-time

### Required Packages

```bash
pnpm add @react-three/fiber @react-three/drei three @mediapipe/face_mesh camera_utils
```

### Architecture

```
Webcam Feed → [MediaPipe Face Mesh] → Facial Landmarks → [Map to Blend Shapes] → Animate Avatar
```

### Implementation Steps

#### 1. Face Detection with MediaPipe

```tsx
// src/lib/faceTracking.ts
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

export function initFaceTracking(
  videoElement: HTMLVideoElement,
  onResults: (landmarks: any) => void
) {
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks?.[0]) {
      onResults(results.multiFaceLandmarks[0]);
    }
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });

  camera.start();
  return () => camera.stop();
}
```

#### 2. Map Landmarks to Blend Shapes

```tsx
// src/lib/blendShapeMapping.ts
export function landmarksToBlendShapes(landmarks: any[]) {
  // Key landmark indices for expressions
  const leftEye = { top: 159, bottom: 145 };
  const rightEye = { top: 386, bottom: 374 };
  const mouth = { top: 13, bottom: 14, left: 61, right: 291 };

  // Calculate eye openness (0 = closed, 1 = open)
  const leftEyeOpen =
    Math.abs(landmarks[leftEye.top].y - landmarks[leftEye.bottom].y) * 10;
  const rightEyeOpen =
    Math.abs(landmarks[rightEye.top].y - landmarks[rightEye.bottom].y) * 10;

  // Calculate mouth openness
  const mouthOpen =
    Math.abs(landmarks[mouth.top].y - landmarks[mouth.bottom].y) * 5;
  const mouthWidth =
    Math.abs(landmarks[mouth.left].x - landmarks[mouth.right].x) * 3;

  // Calculate head rotation from nose position
  const nose = landmarks[1];
  const headRotationY = (nose.x - 0.5) * 2; // -1 to 1
  const headRotationX = (nose.y - 0.5) * 2; // -1 to 1

  return {
    eyeBlinkLeft: 1 - Math.min(leftEyeOpen, 1),
    eyeBlinkRight: 1 - Math.min(rightEyeOpen, 1),
    jawOpen: Math.min(mouthOpen, 1),
    mouthSmile: Math.min(mouthWidth - 0.3, 0.7), // Approximation
    headRotationX,
    headRotationY,
    headRotationZ: 0,
  };
}
```

#### 3. Animated Avatar Component

```tsx
// src/components/AnimatedAvatar.tsx
"use client";
import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import { initFaceTracking } from "@/lib/faceTracking";
import { landmarksToBlendShapes } from "@/lib/blendShapeMapping";

function Avatar({ url, blendShapes }: { url: string; blendShapes: any }) {
  const { scene } = useGLTF(url);
  const avatarRef = useRef<any>();

  useFrame(() => {
    if (!avatarRef.current || !blendShapes) return;

    // Apply head rotation
    avatarRef.current.rotation.x = blendShapes.headRotationX * 0.3;
    avatarRef.current.rotation.y = blendShapes.headRotationY * 0.5;

    // Apply blend shapes to mesh (Ready Player Me uses ARKit naming)
    scene.traverse((child: any) => {
      if (child.morphTargetDictionary && child.morphTargetInfluences) {
        const dict = child.morphTargetDictionary;
        const influences = child.morphTargetInfluences;

        if (dict["eyeBlinkLeft"] !== undefined) {
          influences[dict["eyeBlinkLeft"]] = blendShapes.eyeBlinkLeft;
        }
        if (dict["eyeBlinkRight"] !== undefined) {
          influences[dict["eyeBlinkRight"]] = blendShapes.eyeBlinkRight;
        }
        if (dict["jawOpen"] !== undefined) {
          influences[dict["jawOpen"]] = blendShapes.jawOpen;
        }
        if (dict["mouthSmileLeft"] !== undefined) {
          influences[dict["mouthSmileLeft"]] = blendShapes.mouthSmile;
        }
        if (dict["mouthSmileRight"] !== undefined) {
          influences[dict["mouthSmileRight"]] = blendShapes.mouthSmile;
        }
      }
    });
  });

  return <primitive ref={avatarRef} object={scene} position={[0, -1, 0]} />;
}

export default function AnimatedAvatar({ avatarUrl }: { avatarUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blendShapes, setBlendShapes] = useState<any>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const cleanup = initFaceTracking(videoRef.current, (landmarks) => {
      setBlendShapes(landmarksToBlendShapes(landmarks));
    });

    return cleanup;
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Hidden video for face tracking */}
      <video
        ref={videoRef}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        autoPlay
        playsInline
      />

      {/* 3D Avatar */}
      <Canvas camera={{ position: [0, 0, 2], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Avatar url={avatarUrl} blendShapes={blendShapes} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}
```

---

## Part 3: Integration with Video Rooms

Replace the video feed in `VideoGrid.tsx` with the animated avatar:

```tsx
// In your video room component
import AnimatedAvatar from "@/components/AnimatedAvatar";

// Instead of showing <video> element:
{
  userHasAvatar ? (
    <AnimatedAvatar avatarUrl={user.avatarUrl} />
  ) : (
    <video ref={videoRef} autoPlay playsInline />
  );
}
```

---

## Environment Variables

Add to `.env.local`:

```
NEXT_PUBLIC_RPM_SUBDOMAIN=your_subdomain
```

---

## Summary

| Component              | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `AvatarCreator.tsx`    | Create avatars from selfies via Ready Player Me |
| `faceTracking.ts`      | Detect facial landmarks with MediaPipe          |
| `blendShapeMapping.ts` | Convert landmarks to avatar blend shapes        |
| `AnimatedAvatar.tsx`   | Render and animate the 3D avatar                |

**Result:** Users see animated avatars instead of video feeds. When they smile, turn their head, or blink — the avatar does the same in real-time.
