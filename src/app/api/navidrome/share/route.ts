import { NextResponse } from 'next/server';
import { getNavidromeConfig } from '@/lib/navidrome/config';
import { getAlbumShare, getSongShare } from '@/lib/navidrome/share';

export async function POST(request: Request) {
  let body: { type?: string; id?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const { type, id, lang } = body;
  if ((type !== 'song' && type !== 'album') || !id || !lang) {
    return NextResponse.json({ ok: false, error: 'invalid_params' }, { status: 400 });
  }
  if (!getNavidromeConfig()) {
    return NextResponse.json({ ok: false, error: 'unconfigured' }, { status: 400 });
  }

  const data =
    type === 'song' ? await getSongShare(id, lang) : await getAlbumShare(id, lang);

  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data });
}