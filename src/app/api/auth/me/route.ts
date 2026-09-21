import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";

export async function GET() {
  if (isReadOnly()) {
    return NextResponse.json({ user: null });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
  });
}
