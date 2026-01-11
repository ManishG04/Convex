"use client";

import type { BossState } from "@/lib/hooks/useBossBattle";

interface BossBattleProps {
  bossState: BossState;
  isBattleActive: boolean;
  isDistracted: boolean;
  onStartBattle: () => void;
  onResetBattle: () => void;
}

export function BossBattle({
  bossState,
  isBattleActive,
  isDistracted,
  onStartBattle,
  onResetBattle,
}: BossBattleProps) {
  // Get HP bar color based on percentage
  const getHpBarColor = (percentage: number) => {
    if (percentage > 60) return "bg-green-500";
    if (percentage > 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Get HP bar glow effect
  const getHpBarGlow = (percentage: number) => {
    if (percentage > 60) return "shadow-green-500/50";
    if (percentage > 30) return "shadow-yellow-500/50";
    return "shadow-red-500/50";
  };

  if (!isBattleActive) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">⚔️ Boss Battle</h3>
          <p className="text-gray-400 text-sm mb-4">
            Stay focused to defeat the boss! Looking away pauses damage.
          </p>
          <button
            onClick={onStartBattle}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg shadow-red-600/30"
          >
            🎯 Start Battle
          </button>
        </div>
      </div>
    );
  }

  if (bossState.isDefeated) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-green-600 shadow-lg shadow-green-600/20">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-2xl font-bold text-green-400 mb-4">
            Victory!
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            The Focus Destroyer has been defeated!
          </p>
          <button
            onClick={onResetBattle}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
          >
            🔄 Battle Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate effective damage rate
  const distractedCount = bossState.totalParticipants - bossState.focusedParticipants;
  const effectiveDamage = isDistracted 
    ? 0 
    : Math.max(0, bossState.damagePerSecond - (distractedCount * 5));

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Boss Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-red-400">👹 Focus Destroyer</h3>
          {bossState.totalParticipants > 1 && (
            <p className="text-gray-500 text-xs">
              {bossState.focusedParticipants}/{bossState.totalParticipants} participants focused
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white font-mono text-lg">
            {Math.ceil(bossState.currentHp)}{" "}
            <span className="text-gray-500">/ {bossState.maxHp}</span>
          </p>
          <p className="text-gray-500 text-xs">HP</p>
        </div>
      </div>

      {/* ============================================== */}
      {/* 🖼️ BOSS IMAGE PLACEHOLDER - REPLACE THIS DIV */}
      {/* ============================================== */}
      {/* 
        To add your boss image:
        1. Place your image in /public folder (e.g., /public/boss.png)
        2. Replace the div below with:
           <img 
             src="/boss.png" 
             alt="Boss" 
             className="w-32 h-32 mx-auto mb-4 object-contain"
           />
        Or use next/image for optimization:
           import Image from "next/image";
           <Image 
             src="/boss.png" 
             alt="Boss" 
             width={128} 
             height={128} 
             className="mx-auto mb-4"
           />
      */}
      <div className="w-32 h-32 mx-auto mb-4 bg-gray-800 rounded-lg border-2 border-gray-700 flex items-center justify-center">
        {/* PLACEHOLDER: Boss image goes here */}
        <div className="text-center">
          <span className="text-5xl">👹</span>
          <p className="text-gray-600 text-xs mt-1">Boss Image</p>
        </div>
      </div>
      {/* ============================================== */}
      {/* END OF BOSS IMAGE PLACEHOLDER                 */}
      {/* ============================================== */}

      {/* HP Bar Container */}
      <div className="mb-4">
        <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          {/* HP Bar Fill */}
          <div
            className={`absolute inset-y-0 left-0 ${getHpBarColor(
              bossState.hpPercentage
            )} transition-all duration-100 ease-linear shadow-lg ${getHpBarGlow(
              bossState.hpPercentage
            )}`}
            style={{ width: `${bossState.hpPercentage}%` }}
          />
          {/* HP Bar Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          {/* HP Text Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm drop-shadow-lg">
              {Math.ceil(bossState.hpPercentage)}%
            </span>
          </div>
        </div>
      </div>

      {/* Battle Status */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            isDistracted
              ? "bg-red-900/50 text-red-300 border border-red-700"
              : effectiveDamage === 0
              ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700"
              : "bg-green-900/50 text-green-300 border border-green-700"
          }`}
        >
          {isDistracted ? (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span>Paused - Look at screen!</span>
            </>
          ) : effectiveDamage === 0 ? (
            <>
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span>No damage - Too many distracted!</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Attacking! (-{effectiveDamage} HP/s)</span>
            </>
          )}
        </div>
        <button
          onClick={onResetBattle}
          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-sm transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
