import { NextResponse } from 'next/server';
import { getVoiceSections } from '@/lib/navidrome/voices';
import { getVoicesConfig } from '@/lib/navidrome/config';

/**
 * Return the VOICES Navidrome players (TENOR / BASS / ALTO / SOPRANO) for a
 * song shown in `lang`. Requires the SONGBOOK_VOICES_NAVIDROME_* env vars.
 */
export async function POST(req: Request) {
  let body: { id?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' });
  }

  const { id, lang } = body;
  if (!id || !lang) {
    return NextResponse.json({ ok: false, error: 'invalid_params' });
  }
  if (!getVoicesConfig()) {
    return NextResponse.json({ ok: false, error: 'unconfigured' });
  }

  try {
    const groups = await getVoiceSections(id, lang);
    return NextResponse.json({ ok: true, data: { groups } });
  } catch {
    return NextResponse.json({ ok: false, error: 'search_failed' });
  }
}