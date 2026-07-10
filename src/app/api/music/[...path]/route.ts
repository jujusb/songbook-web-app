import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

const MUSIC_DIR = () => process.env.MUSIC_DIR || path.join(process.cwd(), "public", "music");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");
  const fullPath = path.join(MUSIC_DIR(), relativePath);

  // Security: prevent directory traversal
  const resolved = path.resolve(fullPath);
  const root = path.resolve(MUSIC_DIR());
  if (!resolved.startsWith(root + "/") && resolved !== root) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!existsSync(resolved)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";

  try {
    const buffer = await readFile(resolved);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
