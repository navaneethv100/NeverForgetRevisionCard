import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { generateCards } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { raw_content, subject, topic, concept, existing_questions } = await req.json();
    if (!raw_content) return NextResponse.json({ error: "raw_content is required" }, { status: 400 });

    const cards = await generateCards(raw_content, subject, topic, concept, existing_questions);

    return NextResponse.json({
      flashcards: cards.flashcards,
      mcqs: cards.mcqs,
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
