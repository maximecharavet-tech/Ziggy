# Ziggy — AI Learning for Kids

Premium AI-powered educational platform for children aged 5-12. Teaches AI, math, logic, and creativity through play.

## Features

- AI companion powered by Claude
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
- **Pluggable AI** — Google Gemini (free), Groq (free) or Anthropic Claude

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

## Supported Languages

FR (default), EN, ES, DE, PT, IT, NL, TR, JA, KO, ZH, AR

## License

Proprietary — Ziggy Technologies SAS
