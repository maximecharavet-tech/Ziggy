import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Called by the owner dashboard right after saving site settings, so the
 * landing page reflects them now instead of within the next minute.
 * The caller's access token is verified with Supabase Auth — the role check
 * happens on the server, not in the browser.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`revalidate:${ip}`, 10, 60_000).success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || data.user?.app_metadata?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  revalidatePath('/[locale]', 'page');
  return NextResponse.json({ revalidated: true });
}
