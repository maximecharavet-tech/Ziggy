# Deployment (Vercel + Supabase)

1. **Database** — apply `supabase/migrations/20261010000000_ziggy_world.sql` to the Ziggy Supabase
   project (already applied on `idoynasiaufymzuwnfpe`). It creates the Ziggy World tables, RLS
   policies, functions and the private `ziggy-avatars` bucket.
2. **Vercel environment variables** (Project → Settings → Environment Variables, Production + Preview):
   - Required for AI in Ziggy World: `DEEPSEEK_API_KEY`, `NVIDIA_API_KEY`, `AGNES_API_KEY`
   - Optional: `DEEPSEEK_MODEL`, `NVIDIA_TEXT_MODEL`, `NVIDIA_VISION_MODEL`, `NVIDIA_SAFETY_MODEL`,
     `AGNES_BASE_URL`, `AGNES_IMAGE_MODEL`, `HYPER_ENGINE_API_URL`, `HYPER_ENGINE_API_KEY`,
     `ZIGGY_DAILY_GENERATION_LIMIT`, `ZIGGY_MONTHLY_GENERATION_LIMIT`, `ZIGGY_DAILY_IMAGE_LIMIT`,
     `ZIGGY_PLATFORM_MONTHLY_LIMIT`
   - Existing: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, …
   Never prefix provider keys with `NEXT_PUBLIC_`.
3. **Redeploy** after adding variables (Deployments → ⋯ → Redeploy), or push to `main`.
4. **Check**: `/monde` (map), play a quest, `/monde/parents` (engine status shows which providers are
   configured).

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build on every push.
No GPU, no ComfyUI, no local model: everything runs on Vercel serverless functions.
