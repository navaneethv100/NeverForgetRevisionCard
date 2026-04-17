import { prisma } from "./db";

function toDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return toDateOnly(new Date());
}

export async function getOrCreateStreak(userId: number) {
  let streak = await prisma.userStreak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await prisma.userStreak.create({
      data: { userId },
    });
  }
  return streak;
}

export async function recordReviewActivity(userId: number) {
  const streak = await getOrCreateStreak(userId);
  const today = todayStr();
  const streakTodayDate = streak.todayDate ? toDateOnly(streak.todayDate) : null;

  if (streakTodayDate === today) {
    await prisma.userStreak.update({
      where: { userId },
      data: { reviewsToday: { increment: 1 } },
    });
    return;
  }

  const lastReviewDate = streak.lastReviewDate ? toDateOnly(streak.lastReviewDate) : null;
  const yesterday = toDateOnly(new Date(Date.now() - 86400 * 1000));

  let newCurrentStreak: number;
  let newTotalReviewDays: number;

  if (!lastReviewDate) {
    newCurrentStreak = 1;
    newTotalReviewDays = 1;
  } else if (lastReviewDate === today) {
    // Already reviewed today but todayDate wasn't set — keep streak
    newCurrentStreak = streak.currentStreak;
    newTotalReviewDays = streak.totalReviewDays;
  } else if (lastReviewDate === yesterday) {
    newCurrentStreak = streak.currentStreak + 1;
    newTotalReviewDays = streak.totalReviewDays + 1;
  } else {
    newCurrentStreak = 1;
    newTotalReviewDays = streak.totalReviewDays + 1;
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  await prisma.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastReviewDate: new Date(),
      totalReviewDays: newTotalReviewDays,
      reviewsToday: 1,
      todayDate: new Date(),
    },
  });
}

export async function getStreakInfo(userId: number) {
  const streak = await getOrCreateStreak(userId);
  const today = todayStr();
  const lastReviewDate = streak.lastReviewDate ? toDateOnly(streak.lastReviewDate) : null;
  const streakTodayDate = streak.todayDate ? toDateOnly(streak.todayDate) : null;

  const yesterday = toDateOnly(new Date(Date.now() - 86400 * 1000));
  let currentStreak = streak.currentStreak;
  let reviewsToday = streak.reviewsToday;

  if (lastReviewDate && lastReviewDate < yesterday) {
    currentStreak = 0;
  }
  if (streakTodayDate !== today) {
    reviewsToday = 0;
  }

  return {
    currentStreak,
    longestStreak: streak.longestStreak,
    totalReviewDays: streak.totalReviewDays,
    reviewsToday,
  };
}
