import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOidcConfig } from "@/lib/auth/oidc";

export async function POST(request: NextRequest) {
  // Check if this is an OIDC user that should be redirected to the provider's logout
  const user = await getCurrentUser();
  const oidc = await getOidcConfig();
  const isOidcUser = user?.authProvider === "oidc";
  const logoutUrl = oidc?.logoutUrl;

  // Always clear the local session cookie
  const clearCookie = (res: NextResponse) => {
    res.cookies.set("songbook-session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return res;
  };

  // If OIDC user and a logout URL is configured, tell the client to redirect there
  if (isOidcUser && logoutUrl) {
    const origin = request.nextUrl.origin;
    const separator = logoutUrl.includes("?") ? "&" : "?";
    const redirectUrl = `${logoutUrl}${separator}post_logout_redirect_uri=${encodeURIComponent(origin)}`;
    const response = NextResponse.json({ success: true, redirectUrl });
    return clearCookie(response);
  }

  return clearCookie(NextResponse.json({ success: true }));
}
