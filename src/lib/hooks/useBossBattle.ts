"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface BossState {
  maxHp: number;
  currentHp: number;
  hpPercentage: number;
  isDefeated: boolean;
  damagePerSecond: number;
  totalDamageDealt: number;
  battleStartTime: number | null;
  battleDuration: number;
  focusedParticipants: number;
  totalParticipants: number;
}

const BOSS_CONFIG = {
  maxHp: 1000,
  damagePerSecond: 10, // HP reduced per second when local user is focused
  distractedPenalty: 5, // HP reduction penalty per distracted participant
  updateInterval: 100, // Update every 100ms for smooth animation
};

export function useBossBattle() {
  const [bossState, setBossState] = useState<BossState>({
    maxHp: BOSS_CONFIG.maxHp,
    currentHp: BOSS_CONFIG.maxHp,
    hpPercentage: 100,
    isDefeated: false,
    damagePerSecond: BOSS_CONFIG.damagePerSecond,
    totalDamageDealt: 0,
    battleStartTime: null,
    battleDuration: 0,
    focusedParticipants: 0,
    totalParticipants: 0,
  });

  const [isBattleActive, setIsBattleActive] = useState(false);
  const isLocalDistractedRef = useRef(false);
  const distractedCountRef = useRef(0); // Number of OTHER distracted participants
  const totalParticipantsRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Start the boss battle
  const startBattle = useCallback(() => {
    setBossState({
      maxHp: BOSS_CONFIG.maxHp,
      currentHp: BOSS_CONFIG.maxHp,
      hpPercentage: 100,
      isDefeated: false,
      damagePerSecond: BOSS_CONFIG.damagePerSecond,
      totalDamageDealt: 0,
      battleStartTime: Date.now(),
      battleDuration: 0,
      focusedParticipants: 0,
      totalParticipants: 0,
    });
    setIsBattleActive(true);
    lastUpdateRef.current = Date.now();
  }, []);

  // Stop the boss battle
  const stopBattle = useCallback(() => {
    setIsBattleActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Reset the boss battle
  const resetBattle = useCallback(() => {
    stopBattle();
    setBossState({
      maxHp: BOSS_CONFIG.maxHp,
      currentHp: BOSS_CONFIG.maxHp,
      hpPercentage: 100,
      isDefeated: false,
      damagePerSecond: BOSS_CONFIG.damagePerSecond,
      totalDamageDealt: 0,
      battleStartTime: null,
      battleDuration: 0,
      focusedParticipants: 0,
      totalParticipants: 0,
    });
  }, [stopBattle]);

  // Update local user's distraction state
  const setDistracted = useCallback((distracted: boolean) => {
    isLocalDistractedRef.current = distracted;
  }, []);

  // Update participants info (call with participants array)
  const updateParticipants = useCallback((participants: { isDistracted: boolean }[], localUsername: string) => {
    // Count OTHER distracted participants (excluding local user)
    const otherParticipants = participants.filter(p => 
      // We don't have username in the participant object here, so we count all distracted
      // The local user's distraction is tracked separately
      true
    );
    const distractedOthers = participants.filter(p => p.isDistracted).length;
    
    distractedCountRef.current = distractedOthers;
    totalParticipantsRef.current = participants.length;
  }, []);

  // Main battle loop
  useEffect(() => {
    if (!isBattleActive) return;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000; // Convert to seconds
      lastUpdateRef.current = now;

      setBossState((prev) => {
        // Don't update if already defeated
        if (prev.isDefeated) return prev;

        let newHp = prev.currentHp;
        let damage = 0;

        // Only deal base damage if LOCAL user is NOT distracted
        if (!isLocalDistractedRef.current) {
          damage = BOSS_CONFIG.damagePerSecond * deltaTime;
        }

        // Reduce damage by 5 HP/s for each distracted participant
        const distractedPenalty = distractedCountRef.current * BOSS_CONFIG.distractedPenalty * deltaTime;
        damage = Math.max(0, damage - distractedPenalty);

        newHp = Math.max(0, prev.currentHp - damage);

        const isDefeated = newHp <= 0;
        const hpPercentage = (newHp / prev.maxHp) * 100;
        const battleDuration = prev.battleStartTime
          ? (now - prev.battleStartTime) / 1000
          : 0;

        const focusedCount = totalParticipantsRef.current - distractedCountRef.current;

        return {
          ...prev,
          currentHp: newHp,
          hpPercentage,
          isDefeated,
          totalDamageDealt: prev.totalDamageDealt + damage,
          battleDuration,
          focusedParticipants: focusedCount,
          totalParticipants: totalParticipantsRef.current,
        };
      });
    }, BOSS_CONFIG.updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isBattleActive]);

  return {
    bossState,
    isBattleActive,
    startBattle,
    stopBattle,
    resetBattle,
    setDistracted,
    updateParticipants,
  };
}
