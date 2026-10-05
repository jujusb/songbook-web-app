import { NextResponse } from "next/server";
import { getUserByUsername, createUser, createSession } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";

export async function POST(request: Request) {
  if (isReadOnlyFor('user_write')) {
    return NextResponse.json({ error: "Registration disabled" }, { status: 403 });
  }

  try {
    const { username, password, displayName } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const user = await createUser(username, password, 'setlist_creator', displayName);

    const token = await createSession(user);

    const response = NextResponse.json({ success: true, role: user.role, userId: user.id });
    response.cookies.set("songbook-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Registration failed" }, { status: 500 });
  }
}