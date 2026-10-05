import { NextResponse } from "next/server";
import { getLanguagesConfig } from "@/lib/content";

export async function GET() {
  try {
    const config = await getLanguagesConfig();
    return NextResponse.json({ languages: config.languages, default: config.default });
  } catch {
    return NextResponse.json(
      { error: "Failed to get languages" },
      { status: 500 }
    );
  }
}