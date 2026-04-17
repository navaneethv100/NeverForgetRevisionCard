import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { classifyContent, generateCards, scrapeUrl } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    const text = await scrapeUrl(url);
    if (!text || text.length < 20) {
      return NextResponse.json({ error: "Could not extract content from URL" }, { status: 400 });
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
      source_type: "url",
      source_url: url,
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
