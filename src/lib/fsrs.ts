export interface MemoryState {
  stability: number;
  difficulty: number;
  retrievability: number;
}

const PARAMS = {
  requestRetention: 0.9,
  initialStability: { again: 0.5, hard: 2.0, good: 5.0, easy: 14.0 },
  difficultyIncrease: 0.15,
  difficultyDecrease: 0.05,
  growthMultiplier: { hard: 1.2, good: 2.5, easy: 4.0 },
  againStabilityFraction: 0.3,
};

export function calculateRetrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.exp(-elapsedDays / stability);
}

export function nextInterval(stability: number): number {
  if (stability <= 0) return 1;
  const interval = stability * Math.log(PARAMS.requestRetention) / Math.log(0.9);
  return Math.max(1, interval);
}

export function updateMemoryState(
  state: MemoryState,
  elapsedDays: number,
  rating: "again" | "hard" | "good" | "easy"
): MemoryState {
  const newState = { ...state };

  // Update difficulty
  if (rating === "again") {
    newState.difficulty = Math.min(1.0, state.difficulty + PARAMS.difficultyIncrease * (1 - state.difficulty));
  } else {
    newState.difficulty = Math.max(0.1, state.difficulty - PARAMS.difficultyDecrease * state.difficulty);
  }

  // Update stability
  if (state.stability === 0) {
    newState.stability = PARAMS.initialStability[rating] ?? PARAMS.initialStability.good;
  } else if (rating === "again") {
    newState.stability = Math.max(0.5, state.stability * PARAMS.againStabilityFraction);
  } else {
    const baseGrowth = PARAMS.growthMultiplier[rating as "hard" | "good" | "easy"] ?? PARAMS.growthMultiplier.good;
    const difficultyFactor = 1.0 - 0.3 * (newState.difficulty - 0.1);
    const scheduledInterval = nextInterval(state.stability);
    const overdueRatio = elapsedDays / Math.max(1.0, scheduledInterval);
    let overdueBonus = 1.0;
    if (overdueRatio > 1.1) {
      overdueBonus = 1.0 + Math.min(0.5, (overdueRatio - 1.0) * 0.3);
    }
    newState.stability = state.stability * baseGrowth * difficultyFactor * overdueBonus;
  }

  newState.retrievability = calculateRetrievability(newState.stability, 0);
  return newState;
}

export function scheduleNextReview(state: MemoryState): { intervalDays: number; nextDate: Date } {
  let intervalDays = nextInterval(state.stability);
  intervalDays = Math.max(1.0, Math.min(intervalDays, 365 * 5));
  const nextDate = new Date(Date.now() + intervalDays * 86400 * 1000);
  return { intervalDays, nextDate };
}

export function intervalMessage(days: number): string {
  if (days < 1.5) return "See you tomorrow.";
  if (days < 7) return `Next review in ${Math.round(days)} days.`;
  if (days < 30) return `Next review in ${Math.round(days)} days. Memory is solidifying.`;
  return `Next review in ${Math.round(days)} days. Strong memory!`;
}

export function initMemoryState(): MemoryState {
  return { stability: 0, difficulty: 0.3, retrievability: 0 };
}
