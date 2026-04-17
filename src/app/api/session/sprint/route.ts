import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateRetrievability } from "@/lib/fsrs";

const REVIEW_CARDS_LIMIT = 200;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const simulateDate = searchParams.get("simulate_date");

  const threshold = 0.7;
  let now = new Date();
  if (simulateDate) {
    try { now = new Date(simulateDate + "T23:59:59.999Z"); } catch {}
  }

  const allStates = await prisma.cardMemoryState.findMany({
    where: { userId: user.id, lastReviewedAt: { not: null } },
  });

  const atRisk: Array<[number, object]> = [];

  for (const ms of allStates) {
    const elapsed = ms.lastReviewedAt
      ? (now.getTime() - ms.lastReviewedAt.getTime()) / (86400 * 1000)
      : 0;
    const r = ms.stability > 0 ? calculateRetrievability(ms.stability, elapsed) : 0;

    if (r < threshold) {
      const card = await prisma.card.findUnique({ where: { id: ms.cardId } });
      if (!card) continue;

      atRisk.push([r, {
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
        retrievability: Math.round(r * 1000) / 1000,
        review_count: ms.reviewCount,
      }]);
    }
  }

  atRisk.sort((a, b) => a[0] - b[0]);
  const cards = atRisk.slice(0, REVIEW_CARDS_LIMIT).map(([, card]) => card);

  return NextResponse.json({
    total_due: cards.length,
    estimated_minutes: Math.max(1, Math.round(cards.length * 1.1)),
    cards,
  });
}
