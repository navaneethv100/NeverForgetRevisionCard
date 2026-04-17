import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { processYoutubeVideo } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });

    const result = await processYoutubeVideo(url);

    return NextResponse.json({
      subject: result.subject,
      topic: result.topic,
      concept: result.concept,
      flashcards: result.flashcards,
      mcqs: result.mcqs,
      raw_content: result.contentText,
      source_type: "youtube",
      source_url: url,
      video_id: result.videoId,
      video_title: result.videoTitle,
      content_source: result.contentSource,
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
