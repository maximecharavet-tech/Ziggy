# Ziggy — AI Learning for Kids

Premium AI-powered educational platform for children aged 5-12. Teaches AI, math, logic, and creativity through play.

## Features

- **Ziggy World** (`/monde`) — 20 worlds, 120 quests, 20 adaptive arcade games, 8 companions,
  Story Builder, Avatar Studio, Magic Moments and a parent console, powered by Hyper Engine
  (DeepSeek · NVIDIA · Agnes) with local fallbacks. See `docs/ARCHITECTURE.md`.
- AI companion chat (Gemini, DeepSeek, NVIDIA, Groq or Claude)
- 12 languages with automatic detection
- 5 learning modules (AI, Math, Logic, Creativity, Seasonal)
- Gamified learning with badges and rewards
- GDPR-compliant, kid-safe environment
- PWA-ready, works on all devices
- Dark mode support

## Tech Stack

- **Next.js 15** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4**
- **Framer Motion**
- **next-intl v4** (12 locales)
- **Pluggable AI** — Gemini, DeepSeek, NVIDIA NIM, Groq or Anthropic Claude; Agnes for images
- **Supabase** (auth, RLS, private storage) · **Zod** · **Phaser 3** · **Vitest**

## Getting Started

```bash
git clone <repo-url>
cd Ziggy
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The site runs with no configuration at all — only Ziggy's chat needs a key.
To switch it on, grab a **free** Google Gemini key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit
card) and put it in `.env.local`:

```
GEMINI_API_KEY=your-key-here
```

Groq (`GROQ_API_KEY`) and Anthropic (`ANTHROPIC_API_KEY`) work too — whichever
key is present is the one that gets used.

Ziggy World needs no key either: without `DEEPSEEK_API_KEY`, `NVIDIA_API_KEY` and
`AGNES_API_KEY` it plays entirely on hand-written local content. See `.env.example`
and `docs/DEPLOYMENT.md`.

## Documentation

`docs/ARCHITECTURE.md` · `docs/GAME_ENGINE.md` · `docs/SECURITY.md` · `docs/PRIVACY.md` ·
`docs/AI_PROVIDERS.md` · `docs/MISTRAL.md` · `docs/DEPLOYMENT.md` · `docs/GITHUB_INSPIRATION.md`

```bash
npm test          # vitest
npm run lint
npm run build
```

## Supported Languages

FR (default), EN, ES, DE, PT, IT, NL, TR, JA, KO, ZH, AR

## License

Proprietary — Ziggy Technologies SAS
