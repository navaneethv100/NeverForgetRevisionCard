import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import googleTTS from "google-tts-api";

const MAX_CARDS = 100;
const CONCURRENCY = 10; // parallel TTS requests

// Minimal valid MP3 frame of silence (~26ms each)
const SILENT_FRAME = Buffer.from(
  "fff3e4c400000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000000000000000000000000000000000000",
  "hex"
);

function generateSilence(durationMs: number): Buffer {
  const framesNeeded = Math.ceil(durationMs / 26);
  const frames: Buffer[] = [];
  for (let i = 0; i < framesNeeded; i++) frames.push(SILENT_FRAME);
  return Buffer.concat(frames);
}

async function textToMp3(text: string): Promise<Buffer> {
  const clean = text.replace(/[^\w\s.,;:!?'"()-]/g, " ").trim();
  if (!clean) return Buffer.alloc(0);

  const urls = googleTTS.getAllAudioUrls(clean, {
    lang: "en-in",
    slow: false,
    host: "https://translate.google.com",
  });

  // Download all chunks for this text in parallel
  const buffers = await Promise.all(
    urls.map(async ({ url }) => {
      const res = await fetch(url);
      if (!res.ok) return Buffer.alloc(0);
      return Buffer.from(await res.arrayBuffer());
    })
  );
  return Buffer.concat(buffers);
}

function buildCardText(card: {
  cardType: string;
  front: string | null;
  back: string | null;
  options: string | null;
  correctOption: string | null;
  explanation: string | null;
}, index: number): string {
  // Combine everything into one TTS call per card:
  // "Card 1. <question>. ... The answer is: <answer>"
  const question = card.front || "No question available";

  let answer: string;
  if (card.cardType === "mcq") {
    const opts = card.options ? JSON.parse(card.options) : {};
    const correctKey = card.correctOption || "";
    const correctText = opts[correctKey] || "";
    answer = `The correct answer is option ${correctKey}, ${correctText}.`;
    if (card.explanation) answer += ` ${card.explanation}`;
  } else {
    answer = card.back || "No answer available";
  }

  // Single combined text — Google TTS natural pauses at periods
  return `Card ${index + 1}. ${question}. ... ... ... The answer is. ${answer}`;
}

// Process items in batches of CONCURRENCY
async function parallelMap<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fn));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { subject?: string; topic?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const where: Record<string, unknown> = { userId: user.id };
  if (body.subject) where.subject = body.subject;
  if (body.topic) where.topic = body.topic;

  const cards = await prisma.card.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_CARDS,
  });

  if (!cards.length) {
    return NextResponse.json({ error: "No cards found for the selected filters" }, { status: 404 });
  }

  const pause = generateSilence(2000);

  // Build all card texts, then convert to audio in parallel batches
  const cardTexts = cards.map((card, i) => buildCardText(card, i));

  const [introAudio, outroAudio, ...cardAudios] = await parallelMap(
    [
      `NeverForget revision audio. ${cards.length} cards. Let us begin.`,
      `That is all ${cards.length} cards. Great job revising!`,
      ...cardTexts,
    ],
    textToMp3
  );

  // Assemble: intro + pause + (card + pause) * N + outro
  const chunks: Buffer[] = [introAudio, pause];
  for (const audio of cardAudios) {
    chunks.push(audio, pause);
  }
  chunks.push(outroAudio);

  const finalAudio = Buffer.concat(chunks);

  const subject = body.subject || "all-subjects";
  const date = new Date().toISOString().split("T")[0];
  const filename = `revision-${subject.toLowerCase().replace(/\s+/g, "-")}-${date}.mp3`;

  return new NextResponse(finalAudio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(finalAudio.length),
    },
  });
}
