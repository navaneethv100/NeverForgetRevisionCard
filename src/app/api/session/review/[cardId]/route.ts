import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateMemoryState, scheduleNextReview, intervalMessage, initMemoryState } from "@/lib/fsrs";
import { recordReviewActivity } from "@/lib/streak-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const cardIdNum = parseInt(cardId);

  const { rating, response_time_ms = 5000 } = await req.json();

  const validRatings = new Set(["again", "hard", "good", "easy"]);
  if (!validRatings.has(rating)) {
    return NextResponse.json({ error: "Invalid rating. Must be again, hard, good, or easy" }, { status: 400 });
  }

  try {
    let ms = await prisma.cardMemoryState.findUnique({ where: { cardId: cardIdNum } });
    if (!ms) {
      const init = initMemoryState();
      ms = await prisma.cardMemoryState.create({
        data: {
          cardId: cardIdNum,
          userId: user.id,
          stability: init.stability,
          difficulty: init.difficulty,
          retrievability: init.retrievability,
          nextReviewDate: null,
          reviewCount: 0,
        },
      });
    }

    const now = new Date();
    const elapsedDays = ms.lastReviewedAt
      ? (now.getTime() - ms.lastReviewedAt.getTime()) / (86400 * 1000)
      : 0;

    const currentState = {
      stability: ms.stability,
      difficulty: ms.difficulty,
      retrievability: ms.retrievability,
    };

    const newState = updateMemoryState(currentState, elapsedDays, rating as "again" | "hard" | "good" | "easy");
    const { intervalDays, nextDate } = scheduleNextReview(newState);

    await prisma.cardMemoryState.update({
      where: { cardId: cardIdNum },
      data: {
        stability: newState.stability,
        difficulty: newState.difficulty,
        retrievability: newState.retrievability,
        nextReviewDate: nextDate,
        reviewCount: { increment: 1 },
        lastReviewedAt: now,
      },
    });

    await prisma.reviewLog.create({
      data: {
        cardId: cardIdNum,
        userId: user.id,
        rating,
        responseTimeMs: response_time_ms,
        stabilityAfter: newState.stability,
        difficultyAfter: newState.difficulty,
        intervalDays,
        reviewedAt: now,
      },
    });

    await recordReviewActivity(user.id);

    return NextResponse.json({
      card_id: cardIdNum,
      next_review_date: nextDate,
      interval_days: Math.round(intervalDays * 10) / 10,
      stability: Math.round(newState.stability * 1000) / 1000,
      message: intervalMessage(intervalDays),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Review processing failed" }, { status: 500 });
  }
}
