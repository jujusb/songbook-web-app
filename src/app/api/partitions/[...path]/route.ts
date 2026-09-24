import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { getPartitionsDir } from "@/lib/partitions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");
  const fullPath = path.join(getPartitionsDir(), relativePath);

  // Security: prevent directory traversal
  const resolved = path.resolve(fullPath);
  const root = path.resolve(getPartitionsDir());
  if (!resolved.startsWith(root + "/") && resolved !== root) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!existsSync(resolved)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== ".pdf") {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    const buffer = await readFile(resolved);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}