import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateRetrievability } from "@/lib/fsrs";
import { REVIEW_CARDS_LIMIT } from "@/lib/session-config";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const simulateDate = searchParams.get("simulate_date");
  const cardIdsParam = searchParams.get("card_ids");

  let now = new Date();
  if (simulateDate) {
    try {
      now = new Date(simulateDate + "T23:59:59.999Z");
    } catch {}
  }

  let allStates;

  if (cardIdsParam) {
    const ids = cardIdsParam.split(",").map(Number).filter(Boolean);
    allStates = await prisma.cardMemoryState.findMany({
      where: { userId: user.id, cardId: { in: ids } },
    });
  } else {
    const newStates = await prisma.cardMemoryState.findMany({
      where: { userId: user.id, nextReviewDate: null },
    });
    const dueStates = await prisma.cardMemoryState.findMany({
      where: { userId: user.id, nextReviewDate: { lte: now, not: null } },
      orderBy: { nextReviewDate: "asc" },
    });
    const dueSlice = dueStates.slice(0, REVIEW_CARDS_LIMIT);
    const newSlice = newStates.slice(0, Math.max(0, REVIEW_CARDS_LIMIT - dueSlice.length));
    allStates = [...dueSlice, ...newSlice];
  }

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
