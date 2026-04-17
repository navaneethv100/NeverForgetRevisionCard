import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { classifyContent, generateCards } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { text } = await req.json();
    if (!text || text.length < 20) {
      return NextResponse.json({ error: "Text must be at least 20 characters" }, { status: 400 });
    }

    const classification = await classifyContent(text);
    const cards = await generateCards(text, classification.subject, classification.topic, classification.concept);

    return NextResponse.json({
      subject: classification.subject,
      topic: classification.topic,
      concept: classification.concept,
      flashcards: cards.flashcards,
      mcqs: cards.mcqs,
      raw_content: text,
      source_type: "text",
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
