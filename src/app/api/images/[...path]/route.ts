import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { getDataDir } from '@/lib/content/paths';

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const name = segments.join('/');
  if (name.includes('..')) return new NextResponse('Forbidden', { status: 403 });
  const fullPath = path.join(getDataDir(), 'content', 'images', name);
  if (!existsSync(fullPath)) return new NextResponse('Not found', { status: 404 });
  const buffer = await readFile(fullPath);
  const ext = path.extname(fullPath).slice(1).toLowerCase();
  return new NextResponse(buffer, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
}
