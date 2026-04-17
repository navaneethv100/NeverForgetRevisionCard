import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateRetrievability } from "@/lib/fsrs";
import { getStreakInfo } from "@/lib/streak-service";
import { REVIEW_CARDS_LIMIT } from "@/lib/session-config";
import { UPSC_SYLLABUS } from "@/lib/ai-service";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const simulateDate = searchParams.get("simulate_date");

  let simNow = new Date();
  let simDate = new Date();

  if (simulateDate) {
    try {
      simDate = new Date(simulateDate);
      simNow = new Date(simulateDate + "T23:59:59.999Z");
    } catch {
      simDate = new Date();
      simNow = new Date();
    }
  }

  // Days to exam
  let daysToExam: number | null = null;
  if (user.examDate) {
    const delta = Math.floor((user.examDate.getTime() - simDate.getTime()) / (86400 * 1000));
    daysToExam = Math.max(0, delta);
  }

  // Retention stats
  const stats = await getRetentionStats(user.id, simNow);
  const dueToday = Math.min(stats.dueToday, REVIEW_CARDS_LIMIT) + stats.newCards;
  const estMinutes = Math.max(1, Math.round(dueToday * 1.1));

  // Streak
  const streakData = await getStreakInfo(user.id);

  // Subject coverage
  const subjectCoverage = await buildSubjectCoverage(user.id, simNow);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      exam_date: user.examDate,
      exam_name: user.examName || "UPSC Prelims",
    },
    days_to_exam: daysToExam,
    total_cards: stats.totalCards,
    due_today: dueToday,
    new_cards: stats.newCards,
    cards_at_risk: stats.cardsAtRisk,
    retention_rate: Math.round(stats.avgRetention * 100 * 10) / 10,
    streak_days: streakData.currentStreak,
    longest_streak: streakData.longestStreak,
    total_review_days: streakData.totalReviewDays,
    reviews_today: streakData.reviewsToday,
    estimated_session_minutes: estMinutes,
    subject_coverage: subjectCoverage,
  });
}

async function getRetentionStats(userId: number, now: Date) {
  const states = await prisma.cardMemoryState.findMany({ where: { userId } });

  if (!states.length) {
    return { totalCards: 0, avgRetention: 0, cardsAtRisk: 0, dueToday: 0, newCards: 0 };
  }

  const retentions: number[] = [];
  let atRisk = 0, dueToday = 0, newCards = 0;

  for (const ms of states) {
    const elapsed = ms.lastReviewedAt
      ? (now.getTime() - ms.lastReviewedAt.getTime()) / (86400 * 1000)
      : 0;
    const r = ms.stability > 0 ? calculateRetrievability(ms.stability, elapsed) : 0;
    retentions.push(r);

    if (!ms.nextReviewDate) {
      newCards++;
    } else if (ms.nextReviewDate <= now) {
      dueToday++;
      if (r < 0.6) atRisk++;
    }
  }

  const avg = retentions.reduce((a, b) => a + b, 0) / retentions.length;

  return {
    totalCards: states.length,
    avgRetention: Math.round(avg * 1000) / 1000,
    cardsAtRisk: atRisk,
    dueToday,
    newCards,
  };
}

async function buildSubjectCoverage(userId: number, now: Date) {
  const coverage = [];

  for (const subject of Object.keys(UPSC_SYLLABUS)) {
    const cards = await prisma.card.findMany({
      where: { userId, subject },
      include: { memoryState: true },
    });

    if (!cards.length) {
      coverage.push({ subject, total_cards: 0, retention_pct: 0, status: "critical" });
      continue;
    }

    const retentions: number[] = [];
    for (const card of cards) {
      const ms = card.memoryState;
      if (!ms) { retentions.push(0); continue; }
      const elapsed = ms.lastReviewedAt
        ? (now.getTime() - ms.lastReviewedAt.getTime()) / (86400 * 1000)
        : 0;
      const r = ms.stability > 0 ? calculateRetrievability(ms.stability, elapsed) : 0;
      retentions.push(r);
    }

    const avg = retentions.reduce((a, b) => a + b, 0) / retentions.length;
    const pct = Math.round(avg * 100 * 10) / 10;

    let status: string;
    if (pct >= 80) status = "strong";
    else if (pct >= 60) status = "on_track";
    else if (pct >= 40) status = "behind";
    else status = "critical";

    coverage.push({ subject, total_cards: cards.length, retention_pct: pct, status });
  }

  return coverage;
}
