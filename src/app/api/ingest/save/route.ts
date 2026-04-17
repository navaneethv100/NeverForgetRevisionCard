import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initMemoryState } from "@/lib/fsrs";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subject, topic, concept, raw_content, source_type, source_url, flashcards, mcqs } = await req.json();

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        subject,
        topic,
        concept,
        rawContent: raw_content,
        sourceType: source_type || "text",
        sourceUrl: source_url || null,
      },
    });

    const initState = initMemoryState();
    const createdCards = [];

    for (const fc of flashcards || []) {
      const card = await prisma.card.create({
        data: {
          noteId: note.id,
          userId: user.id,
          cardType: "flashcard",
          front: fc.front,
          hint: fc.hint,
          back: fc.back,
          subject,
          topic,
          concept,
          aiGenerated: true,
        },
      });
      await prisma.cardMemoryState.create({
        data: {
          cardId: card.id,
          userId: user.id,
          stability: initState.stability,
          difficulty: initState.difficulty,
          retrievability: initState.retrievability,
          nextReviewDate: null,
          reviewCount: 0,
        },
      });
      createdCards.push(card);
    }

    for (const mcq of mcqs || []) {
      const card = await prisma.card.create({
        data: {
          noteId: note.id,
          userId: user.id,
          cardType: "mcq",
          front: mcq.question,
          options: JSON.stringify(mcq.options),
          correctOption: mcq.correct_option,
          explanation: mcq.explanation,
          subject,
          topic,
          concept,
          aiGenerated: true,
        },
      });
      await prisma.cardMemoryState.create({
        data: {
          cardId: card.id,
          userId: user.id,
          stability: initState.stability,
          difficulty: initState.difficulty,
          retrievability: initState.retrievability,
          nextReviewDate: null,
          reviewCount: 0,
        },
      });
      createdCards.push(card);
    }

    return NextResponse.json({
      note_id: note.id,
      cards_saved: createdCards.length,
      card_ids: createdCards.map((c) => c.id),
      message: `Saved ${createdCards.length} cards`,
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
