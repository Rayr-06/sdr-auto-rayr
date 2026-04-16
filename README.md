<div align="center">

# 🚀 SDR Autopilot

### AI-powered Sales Development Representative automation pipeline

*From ICP definition to personalised email in your inbox — fully automated, human-approved.*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Claude API](https://img.shields.io/badge/AI-Groq%20%7C%20Claude%20%7C%20OpenAI-orange)](https://console.groq.com)
[![Prisma](https://img.shields.io/badge/DB-SQLite%20+%20Prisma-blue?logo=prisma)](https://prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[Quick Start](#quick-start) · [Features](#features) · [Architecture](#architecture) · [Deploy](#deploy-to-vercel)**

</div>

---

## What is SDR Autopilot?

SDR Autopilot is a **5-stage AI pipeline** that replaces the entire manual SDR research-and-outreach workflow. Each SDR can run the workload of a 3-person team.

| Metric | Manual | With SDR Autopilot |
|--------|--------|-------------------|
| Research time / prospect | 45–60 min | < 3 min |
| Personalisation | Name + company | Role, signals, pain points, timing |
| Prospects / day | 15–25 | 100–200 |
| Time to first send | Half a day | < 30 min |

---

## Features

**5-Stage AI Pipeline**
- **Stage 1 — Market Research:** Define ICP parameters → AI generates TAM analysis, pain points, competitive landscape
- **Stage 2 — Prospect Profiling:** AI generates realistic prospect profiles with ICP fit scores (0–100)
- **Stage 3 — Intent Signals:** Detects hiring, funding, tech changes, news signals with time-decayed scoring
- **Stage 4 — Content Generation:** Claude/Groq/OpenAI drafts personalised emails with 3 subject variants, spam score & readability check
- **Stage 5 — Human-in-the-loop Send:** Review queue → approve / edit / skip → send via SendGrid

**Multi-Provider AI** — priority chain: Groq (free) → Claude → OpenAI → demo mode with no key required

**Production-ready** — Next.js 16, Prisma + SQLite (swappable to Postgres), TypeScript throughout, proper error handling

---

## Quick Start

### Prerequisites
- Node.js 18+ or [Bun](https://bun.sh)
- A free [Groq API key](https://console.groq.com) (takes 30 seconds)

### 1. Clone & install
```bash
git clone https://github.com/Rayr-06/sdr-auto-rayr.git
cd sdr-auto-rayr
npm install
```

### 2. Configure
```bash
cp .env.example .env
```
Edit `.env` — minimum required:
```env
DATABASE_URL=file:./db/sdr.db
GROQ_API_KEY=gsk_your_key_here   # free at console.groq.com
ADMIN_SECRET=any-random-string
```

### 3. Set up database & run
```bash
npm run db:push
npm run dev
```

Open **http://localhost:3000** → click **Run Full Pipeline** → done.

---

## Adding Real Email Delivery (Optional)

Without a SendGrid key, emails are simulated with realistic open/reply metrics. To send real emails:

1. Sign up at [sendgrid.com](https://sendgrid.com) (free: 100 emails/day)
2. Add to `.env`:
```env
SENDGRID_API_KEY=SG.your_key_here
SENDGRID_FROM_EMAIL=you@yourdomain.com
SENDGRID_FROM_NAME=Your Name
```
3. Verify your sender domain in SendGrid dashboard
4. Restart the dev server

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── stage1/    # ICP research & prospect generation
│   │   ├── stage2/    # Prospect enrichment & scoring
│   │   ├── stage3/    # Intent signal collection
│   │   ├── stage4/    # AI email generation (single + batch)
│   │   ├── stage5/    # Approval queue, send, tracking
│   │   ├── pipeline/  # Full 5-stage orchestration
│   │   ├── config/    # LLM provider status
│   │   └── admin/     # Reset (protected by ADMIN_SECRET)
│   ├── page.tsx       # Complete dashboard UI (all 5 stages)
│   ├── layout.tsx
│   └── globals.css
├── components/ui/     # shadcn/ui components
└── lib/
    ├── llm.ts         # Multi-provider AI: Groq → Claude → OpenAI → demo
    ├── db.ts          # Prisma client
    └── api.ts         # Typed frontend API client
prisma/schema.prisma   # Database schema
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 App Router, React, Tailwind CSS, shadcn/ui, Framer Motion |
| AI | Groq (Llama 3.3 70B) · Anthropic Claude · OpenAI · demo fallback |
| Database | SQLite + Prisma (production: swap to Postgres) |
| Email | SendGrid API (optional — demo mode works without it) |
| Charts | Recharts |
| Animations | Framer Motion |

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard:
- `GROQ_API_KEY` or `ANTHROPIC_API_KEY`
- `DATABASE_URL` — use [Neon](https://neon.tech) free Postgres for production
- `ADMIN_SECRET`

For Postgres: change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.

---

## Roadmap

- [ ] Apollo.io / Clearbit integration for real prospect discovery
- [ ] LinkedIn Jobs RSS for live hiring signals
- [ ] Crunchbase webhooks for funding events
- [ ] Multi-step email sequences (day 3, day 7 follow-ups)
- [ ] HubSpot / Salesforce CRM sync
- [ ] Pinecone RAG for email performance learning
- [ ] Multi-user auth with team workspaces
- [ ] A/B subject line analytics

---

## Built by

**Adithya Sharma** · [RAYR Product Suite](https://github.com/Rayr-06) · MIT License
