"use client";

import { useState, useEffect } from "react";
import { AvatarCreator as RPMAvatarCreator } from "@readyplayerme/react-avatar-creator";
import Link from "next/link";

interface SavedAvatar {
  url: string;
  createdAt: string;
}

interface AvatarCreatorProps {
  onAvatarSelected?: (avatarUrl: string) => void;
  subdomain?: string;
}

// Helper to get initial state from localStorage (runs only on client)
function getInitialAvatars(): SavedAvatar[] {
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem("savedAvatars");
  return saved ? JSON.parse(saved) : [];
}

export function AvatarCreatorPage({
  onAvatarSelected,
  subdomain = "demo",
}: AvatarCreatorProps) {
  const [avatars, setAvatars] = useState<SavedAvatar[]>([]);
  const [showCreator, setShowCreator] = useState(true);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [creatorKey, setCreatorKey] = useState(0);
  const [isClient, setIsClient] = useState(false);

  // Initialize client-side state
  useEffect(() => {
    const initialAvatars = getInitialAvatars();
    setAvatars(initialAvatars);
    setShowCreator(initialAvatars.length === 0);
    setCreatorKey(Date.now());
    setIsClient(true);
  }, []);

  const handleAvatarExported = (event: { data: { url: string } }) => {
    const newAvatar: SavedAvatar = {
      url: event.data.url,
      createdAt: new Date().toISOString(),
    };
    const updated = [...avatars, newAvatar];
    setAvatars(updated);
    localStorage.setItem("savedAvatars", JSON.stringify(updated));
    localStorage.setItem("selectedAvatar", event.data.url);
    setShowCreator(false);
    setGender(null);
    onAvatarSelected?.(event.data.url);
  };

  const deleteAvatar = (index: number) => {
    const updated = avatars.filter((_, i) => i !== index);
    setAvatars(updated);
    localStorage.setItem("savedAvatars", JSON.stringify(updated));

    // If deleted avatar was selected, clear selection
    const selectedAvatar = localStorage.getItem("selectedAvatar");
    if (selectedAvatar === avatars[index].url) {
      localStorage.removeItem("selectedAvatar");
    }
  };

  const selectAvatar = (avatarUrl: string) => {
    localStorage.setItem("selectedAvatar", avatarUrl);
    onAvatarSelected?.(avatarUrl);
  };

  const startNewAvatar = () => {
    setCreatorKey(Date.now());
    setShowCreator(true);
    setGender(null);
  };

  // Gender selection screen
  if (showCreator && !gender) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl font-bold text-white mb-2">
          Create Your Avatar
        </h1>
        <p className="text-gray-400 mb-8">Choose your avatar base type</p>

        <div className="flex gap-6 mb-8">
          <button
            onClick={() => setGender("male")}
            className="group flex flex-col items-center p-8 bg-gray-900 hover:bg-gray-800 rounded-2xl transition-all border-2 border-transparent hover:border-blue-500"
          >
            <span className="text-6xl mb-4">👨</span>
            <span className="text-white font-medium text-lg">Male</span>
          </button>
          <button
            onClick={() => setGender("female")}
            className="group flex flex-col items-center p-8 bg-gray-900 hover:bg-gray-800 rounded-2xl transition-all border-2 border-transparent hover:border-pink-500"
          >
            <span className="text-6xl mb-4">👩</span>
            <span className="text-white font-medium text-lg">Female</span>
          </button>
        </div>

        {avatars.length > 0 && (
          <button
            onClick={() => setShowCreator(false)}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to saved avatars ({avatars.length})
          </button>
        )}
      </div>
    );
  }

  // Avatar creator iframe
  if (showCreator && gender) {
    return (
      <div className="h-screen w-screen">
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => setGender(null)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
          >
            ← Back
          </button>
        </div>
        <RPMAvatarCreator
          key={creatorKey}
          subdomain={subdomain}
          config={{
            clearCache: true,
            bodyType: "fullbody",
            quickStart: false,
          }}
          style={{ width: "100%", height: "100%" }}
          onAvatarExported={handleAvatarExported}
        />
      </div>
    );
  }

  // Saved avatars gallery
  const selectedAvatar = localStorage.getItem("selectedAvatar");

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Avatars</h1>
            <p className="text-gray-400 text-sm">
              Select an avatar to use in focus rooms
            </p>
          </div>
          <button
            onClick={startNewAvatar}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>✨</span> Create New Avatar
          </button>
        </div>

        {avatars.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-6xl mb-4 block">🎭</span>
            <h2 className="text-xl font-medium text-white mb-2">
              No avatars yet
            </h2>
            <p className="text-gray-400 mb-6">
              Create your first avatar to get started
            </p>
            <button
              onClick={startNewAvatar}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Avatar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {avatars.map((avatar, index) => (
              <div
                key={index}
                className={`relative bg-gray-900 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedAvatar === avatar.url
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-transparent hover:border-gray-700"
                }`}
                onClick={() => selectAvatar(avatar.url)}
              >
                {/* Avatar preview image */}
                <div className="aspect-square bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar.url.replace(".glb", ".png")}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if PNG doesn't exist
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                {/* Selected indicator */}
                {selectedAvatar === avatar.url && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                )}

                {/* Info bar */}
                <div className="p-3">
                  <p className="text-gray-400 text-xs">
                    {new Date(avatar.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <a
                      href={avatar.url}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                    >
                      Download
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAvatar(index);
                      }}
                      className="flex-1 py-1 text-xs bg-red-900/50 hover:bg-red-900 text-red-300 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedAvatar && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
            <div className="bg-gray-900 border border-gray-700 rounded-full px-6 py-3 shadow-lg flex items-center gap-4">
              <span className="text-green-400">✓ Avatar selected</span>
              <Link
                href="/"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors"
              >
                Join a Room →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
