import { GoogleGenerativeAI } from "@google/generative-ai";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const UPSC_SYLLABUS: Record<string, string[]> = {
  "History & Culture": [
    "Ancient India",
    "Medieval India",
    "Modern India (1757-1947)",
    "World History",
    "Art & Culture",
  ],
  "Geography": [
    "Physical Geography",
    "Indian Geography",
    "World Geography",
    "Economic Geography",
  ],
  "Polity & Governance": [
    "Constitution & Amendments",
    "Parliament & State Legislature",
    "Judiciary",
    "Federalism",
    "Panchayati Raj",
    "Rights & Issues",
  ],
  "Economy": [
    "Indian Economy Basics",
    "Banking & Finance",
    "Agriculture",
    "Poverty & Planning",
    "International Trade",
  ],
  "Environment & Ecology": [
    "Biodiversity",
    "Climate Change",
    "Conservation & Protected Areas",
    "Environmental Laws & Agreements",
  ],
  "Science & Technology": [
    "Space Technology",
    "Defence Technology",
    "Biotechnology",
    "IT & Computers",
  ],
  "Current Affairs": [
    "Government Schemes",
    "National Events",
    "International Events",
    "Awards & Persons",
  ],
};

const SYLLABUS_JSON = JSON.stringify(UPSC_SYLLABUS, null, 2);

const CLASSIFY_PROMPT = `You are a UPSC content classifier.

UPSC SYLLABUS TREE (use ONLY these exact values):
${SYLLABUS_JSON}

Given the content text, return a JSON object with:
- "subject": one of the exact subject names above
- "topic": one of the exact topic names under that subject
- "concept": a 3-6 word label describing the specific idea in this content

Respond ONLY with the JSON object, nothing else.`;

function scaleCardCounts(textLength: number): [number, number] {
  if (textLength < 800) return [3, 2];
  if (textLength < 2000) return [5, 3];
  if (textLength < 4000) return [8, 5];
  return [12, 6];
}

function buildCardGenPrompt(numFlashcards: number, numMcqs: number, existingQuestions?: string[]): string {
  let dedupSection = "";
  if (existingQuestions?.length) {
    const list = existingQuestions.map((q) => `- ${q}`).join("\n");
    dedupSection = `\n\nIMPORTANT — These questions already exist. Do NOT repeat or rephrase them. Generate completely NEW questions covering DIFFERENT aspects of the content:\n${list}\n`;
  }
  return `You are a UPSC study card generator. Given content, subject, and topic, generate high-quality UPSC-level study cards for active recall.

Generate:
- ${numFlashcards} flashcards with front (question), hint, back (concise answer 2-3 sentences)
- ${numMcqs} MCQs in UPSC exam pattern with 4 options, correct_option (A/B/C/D), and explanation
${dedupSection}
Rules:
- Be factually accurate. UPSC students depend on this.
- Questions should require analytical thinking, not just recall.
- MCQ options should be plausible distractors.
- Back/explanation should be substantive.
- Cover different aspects and angles of the content. Avoid redundancy.

Respond ONLY with this JSON structure:
{
  "flashcards": [
    {"front": "...", "hint": "...", "back": "..."}
  ],
  "mcqs": [
    {
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_option": "A",
      "explanation": "..."
    }
  ]
}`;
}

function cleanJson(text: string): string {
  text = text.trim();
  text = text.replace(/^```(?:json)?\s*/m, "");
  text = text.replace(/\s*```$/m, "");
  return text.trim();
}

export async function classifyContent(text: string): Promise<{ subject: string; topic: string; concept: string }> {
  try {
    const model = genai.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: CLASSIFY_PROMPT,
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    });
    const response = await model.generateContent(`Content:\n${text.slice(0, 3000)}`);
    const result = JSON.parse(cleanJson(response.response.text()));

    let subject = result.subject || "";
    let topic = result.topic || "";
    const concept = result.concept || "General Concepts";

    if (!UPSC_SYLLABUS[subject]) subject = "Current Affairs";
    if (!UPSC_SYLLABUS[subject].includes(topic)) topic = UPSC_SYLLABUS[subject][0];

    return { subject, topic, concept };
  } catch (e) {
    console.error("[AI] classifyContent failed:", e);
    return { subject: "Current Affairs", topic: "National Events", concept: "Unclassified Content" };
  }
}

export async function generateCards(
  text: string,
  subject: string,
  topic: string,
  concept: string,
  existingQuestions?: string[]
): Promise<{ flashcards: FlashcardData[]; mcqs: MCQData[] }> {
  const [numFc, numMcq] = scaleCardCounts(text.length);
  const systemPrompt = buildCardGenPrompt(numFc, numMcq, existingQuestions);

  const model = genai.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const prompt = `Subject: ${subject}\nTopic: ${topic}\nConcept: ${concept}\n\nContent:\n${text.slice(0, 6000)}`;

  try {
    const response = await model.generateContent(prompt);
    const result = JSON.parse(cleanJson(response.response.text()));
    return {
      flashcards: result.flashcards || [],
      mcqs: result.mcqs || [],
    };
  } catch (e) {
    console.error("[AI] generateCards failed:", e);
    throw new Error(`Card generation failed: ${e}`);
  }
}

export interface FlashcardData {
  front: string;
  hint: string;
  back: string;
}

export interface MCQData {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: string;
  explanation: string;
}

export async function scrapeUrl(url: string): Promise<string> {
  const { load } = await import("cheerio");
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NeverForget/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const $ = load(html);
  $("script, style, nav, header, footer, aside, form").remove();
  const text = $.root().text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.join("\n").slice(0, 6000);
}

function extractVideoId(url: string): string {
  const patterns = [
    /(?:v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  throw new Error(`Could not extract video ID from: ${url}`);
}

async function getYoutubeTranscript(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    const text = items.map((i) => i.text).join(" ");
    return text.slice(0, 6000) || null;
  } catch (e) {
    console.error("[AI] Transcript fetch failed:", e);
    return null;
  }
}

async function getYoutubeMetadata(videoId: string): Promise<{ title: string; description: string }> {
  let title = "";
  let description = "";
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    title = data.title || "";
  } catch {}
  return { title, description };
}

export async function processYoutubeVideo(url: string): Promise<{
  subject: string; topic: string; concept: string;
  flashcards: FlashcardData[]; mcqs: MCQData[];
  videoId: string; videoTitle: string; contentSource: string;
}> {
  const videoId = extractVideoId(url);
  const metadata = await getYoutubeMetadata(videoId);
  const videoTitle = metadata.title;

  let contentText = "";
  let contentSource = "transcript";

  const transcript = await getYoutubeTranscript(videoId);
  if (transcript) {
    contentText = `Video Title: ${videoTitle}\n\nTranscript:\n${transcript}`;
  } else if (metadata.title) {
    contentText = `Video Title: ${videoTitle}\n\nVideo Description:\n${metadata.description}`;
    contentSource = "metadata";
  } else {
    throw new Error("Could not extract any content from this YouTube video.");
  }

  const classification = await classifyContent(contentText);
  const rawCards = await generateCards(
    contentText,
    classification.subject,
    classification.topic,
    classification.concept
  );

  return {
    ...classification,
    flashcards: rawCards.flashcards,
    mcqs: rawCards.mcqs,
    videoId,
    videoTitle,
    contentSource,
  };
}
