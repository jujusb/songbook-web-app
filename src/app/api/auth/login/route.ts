import { NextResponse } from "next/server";
import { getUserByUsername, verifyPassword, createSession, ensureDefaultAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureDefaultAdmin();
  
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }
    
    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    const valid = await verifyPassword(user, password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    const token = await createSession(user);
    
    const response = NextResponse.json({ success: true, role: user.role });
    response.cookies.set("songbook-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
    
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
  }
}
