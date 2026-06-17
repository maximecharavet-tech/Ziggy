# Ziggy -- AI Learning for Kids

Premium AI-powered educational platform for children aged 5--12.
Teaches AI, math, logic, and creativity through play.

## Features

- AI companion powered by Claude
- 12 languages with automatic detection
- 5 learning modules (AI, Math, Logic, Creativity, Seasonal)
- Gamified learning with badges and rewards
- GDPR-compliant, kid-safe environment
- PWA-ready, works on all devices

## Tech Stack

- **Next.js 15** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4**
- **Framer Motion**
- **next-intl v4** (12 locales)
- **Anthropic Claude API**

## Getting Started

1. Clone and install:

   ```bash
   git clone <repo-url>
   cd Ziggy
   npm install
   ```

2. Set up environment:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Anthropic API key
   ```

3. Run development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/
    [locale]/       # Locale-based routing (fr, en, es, ...)
      demo/         # Interactive demo page
    api/            # API routes (chat endpoint)
    sitemap.ts      # Dynamic sitemap generation
  components/
    layout/         # Header, footer, navigation
    sections/       # Landing page sections
    ui/             # Reusable UI primitives
    ziggy/          # Ziggy character & chat components
  hooks/            # Custom React hooks
  i18n/             # Internationalization config & messages
  lib/              # Utilities and helpers
public/
  icons/            # PWA icons (192x192, 512x512)
  manifest.json     # PWA manifest
  robots.txt        # Crawler directives
```

## Supported Languages

fr (default), en, es, de, pt, it, nl, tr, ja, ko, zh, ar

## License

Proprietary -- Ziggy Technologies SAS
