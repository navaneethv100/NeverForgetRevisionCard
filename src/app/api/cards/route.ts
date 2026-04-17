import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateRetrievability } from "@/lib/fsrs";
import { UPSC_SYLLABUS } from "@/lib/ai-service";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const topic = searchParams.get("topic");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "newest";

  const where: Record<string, unknown> = { userId: user.id };
  if (subject) where.subject = subject;
  if (topic) where.topic = topic;
  if (search) {
    where.OR = [
      { front: { contains: search } },
      { back: { contains: search } },
      { concept: { contains: search } },
    ];
  }

  const orderBy = sort === "oldest"
    ? { createdAt: "asc" as const }
    : { createdAt: "desc" as const };

  const cards = await prisma.card.findMany({
    where,
    orderBy,
    include: { memoryState: true },
  });

  const now = new Date();

  const result = cards.map((card) => {
    const ms = card.memoryState;
    const elapsed = ms?.lastReviewedAt
      ? (now.getTime() - ms.lastReviewedAt.getTime()) / (86400 * 1000)
      : 0;
    const r = ms && ms.stability > 0 ? calculateRetrievability(ms.stability, elapsed) : 0;

    let cardStatus = "new";
    if (ms) {
      if (!ms.nextReviewDate) cardStatus = "new";
      else if (ms.nextReviewDate <= now) cardStatus = r < 0.6 ? "weak" : "due";
      else cardStatus = r >= 0.7 ? "strong" : "due";
    }

    return {
      id: card.id,
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
      verified: card.verified,
      status: cardStatus,
      retention_pct: Math.round(r * 100),
      review_count: ms?.reviewCount || 0,
      created_at: card.createdAt,
    };
  }).filter((card) => {
    if (!status) return true;
    return card.status === status;
  });

  const sortedResult = sort === "weakest"
    ? result.sort((a, b) => a.retention_pct - b.retention_pct)
    : result;

  const subjects = Object.keys(UPSC_SYLLABUS);
  const topics = subject ? (UPSC_SYLLABUS[subject] || []) : [];

  return NextResponse.json({
    cards: sortedResult,
    subjects,
    topics,
    total: sortedResult.length,
  });
}
