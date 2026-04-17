import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateRetrievability } from "@/lib/fsrs";

const NEW_CARDS_PER_DAY = 30;
const REVIEW_CARDS_LIMIT = 200;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const simulateDate = searchParams.get("simulate_date");

  let now = new Date();
  if (simulateDate) {
    try {
      now = new Date(simulateDate + "T00:00:00.000Z");
    } catch {}
  }

  const newStates = await prisma.cardMemoryState.findMany({
    where: { userId: user.id, nextReviewDate: null },
  });

  const dueStates = await prisma.cardMemoryState.findMany({
    where: {
      userId: user.id,
      nextReviewDate: { lte: now, not: null },
    },
    orderBy: { nextReviewDate: "asc" },
  });

  const allStates = [...dueStates.slice(0, REVIEW_CARDS_LIMIT), ...newStates.slice(0, NEW_CARDS_PER_DAY)];

  const cards = [];
  for (const ms of allStates) {
    const card = await prisma.card.findUnique({ where: { id: ms.cardId } });
    if (!card) continue;

    const elapsed = ms.lastReviewedAt
      ? (now.getTime() - ms.lastReviewedAt.getTime()) / (86400 * 1000)
      : 0;

    const retrievability = ms.stability > 0 ? calculateRetrievability(ms.stability, elapsed) : 0;

    cards.push({
      card_id: card.id,
      card_type: card.cardType,
      front: card.front,
      hint: card.hint,
      back: card.back,
      options: card.options ? JSON.parse(card.options) : null,
      correct_option: card.correctOption,
      explanation: card.explanation,
      subject: card.subject,
      topic: card.topic,
      concept: card.concept,
      retrievability: Math.round(retrievability * 1000) / 1000,
      review_count: ms.reviewCount,
    });
  }

  return NextResponse.json({
    total_due: cards.length,
    estimated_minutes: Math.max(1, Math.round(cards.length * 1.1)),
    cards,
  });
}
