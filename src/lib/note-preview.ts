import { NextResponse } from 'next/server';
import { interpolateApiUrl, type NoteSection } from '@/lib/notes';

type PreviewTransform = (data: unknown) => unknown;

export async function previewApiSection(
  section: NoteSection,
  lang?: string,
  date?: string,
  transform?: PreviewTransform,
) {
  const template = section.api_url?.trim();
  if (!template) {
    return NextResponse.json({ error: 'Missing api_url' }, { status: 400 });
  }
  const url = interpolateApiUrl(template, { lang, date });
  return fetchPreviewUrl(url, section.authorization, transform);
}

export async function fetchPreviewUrl(
  url: string,
  authorization?: string,
  transform?: PreviewTransform,
) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: text || `HTTP ${res.status}`, status: res.status }, { status: res.status });
  }

  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep text
  }
  if (transform) {
    return NextResponse.json(transform(data));
  }
  return NextResponse.json({ data });
}
