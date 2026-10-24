import { NextResponse } from 'next/server';
import { getVoiceSections } from '@/lib/navidrome/voices';
import { getVoicesConfig } from '@/lib/navidrome/config';

const CONCURRENCY = 5;

export async function POST(req: Request) {
  let body: { items?: { id: string; lang: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_items' });
  }
  if (!getVoicesConfig()) {
    return NextResponse.json({ ok: false, error: 'unconfigured' });
  }

  try {
    const results: { songId: string; groups: Awaited<ReturnType<typeof getVoiceSections>> }[] = [];

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            const groups = await getVoiceSections(item.id, item.lang);
            return { songId: item.id, groups };
          } catch {
            return { songId: item.id, groups: [] };
          }
        })
      );
      results.push(...batchResults);
    }

    return NextResponse.json({ ok: true, data: { results } });
  } catch {
    return NextResponse.json({ ok: false, error: 'search_failed' });
  }
}