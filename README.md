# NeverForget — UPSC Revision OS

A spaced repetition flashcard app built for UPSC exam preparation. Add study content from text, URLs, or YouTube — AI generates flashcards and MCQs, then schedules them using the FSRS algorithm so you review cards at the optimal time.

## Features

- **3 content sources** — Paste text, scrape any URL, or extract from YouTube (transcript-first)
- **AI card generation** — Gemini classifies content into the UPSC syllabus tree and generates flashcards + MCQs
- **FSRS spaced repetition** — Scientifically-backed algorithm schedules reviews based on your memory strength
- **4-level rating** — Again / Hard / Good / Easy updates each card's review interval
- **Exam Sprint mode** — Activates when exam is ≤14 days away; shows all at-risk cards
- **Dashboard** — Retention rate, subject coverage, streaks, days to exam countdown
- **Light / Dark theme**

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Prisma + SQLite** — file-based database, zero setup
- **Google Gemini AI** (`gemini-2.0-flash`) — content classification and card generation
- **JWT auth** — `jose` + `bcryptjs`
- **Tailwind CSS v4**

## Setup

### 1. Clone & install

```bash
git clone https://github.com/navaneethv100/NeverForgetRevisionCard.git
cd NeverForgetRevisionCard
npm install
```

### 2. Environment variables

Create a `.env.local` file in the project root:

```env
DATABASE_URL="file:./data/neverforget.db"
JWT_SECRET="your-secret-key-change-this"
GEMINI_API_KEY="your-gemini-api-key"
```

Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey).

### 3. Initialize the database

```bash
npx prisma db push
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start adding content.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── login/page.tsx        # Auth
│   ├── add/page.tsx          # Add content (ingest)
│   ├── session/page.tsx      # Study session
│   ├── cards/page.tsx        # Browse & manage cards
│   └── api/                  # All API routes
│       ├── auth/             # signup, login
│       ├── ingest/           # text, url, youtube, save
│       ├── session/          # today, sprint, review
│       ├── dashboard/        # stats, user settings
│       └── cards/            # list, edit, delete
├── lib/
│   ├── fsrs.ts               # FSRS spaced repetition algorithm
│   ├── ai-service.ts         # Gemini card generation + URL/YouTube scraping
│   ├── streak-service.ts     # Daily review streaks
│   └── auth.ts               # JWT utilities
prisma/
└── schema.prisma             # Database schema
```

## UPSC Syllabus Coverage

Cards are automatically classified into: History & Culture, Geography, Polity & Governance, Economy, Environment & Ecology, Science & Technology, Current Affairs.

## License

MIT
