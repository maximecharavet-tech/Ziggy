import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage } from '@/lib/detect-language';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    const language = detectLanguage(text);
    return NextResponse.json({ language });
  } catch {
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 });
  }
}
