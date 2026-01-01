"use client";

import { useEffect } from "react";
import { JoinForm } from "@/components";
import { preloadMediaPipe } from "@/lib/faceTracking";

export default function Home() {
  // Preload MediaPipe as soon as page loads (before user joins)
  useEffect(() => {
    preloadMediaPipe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <JoinForm />
    </div>
  );
}
