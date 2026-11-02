import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  return handleFetch(url, request.nextUrl.searchParams.get('authorization') || undefined);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const url = body?.url;
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  return handleFetch(url, body?.authorization);
}

async function handleFetch(url: string, authorization?: string) {
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
  return NextResponse.json({ data });
}