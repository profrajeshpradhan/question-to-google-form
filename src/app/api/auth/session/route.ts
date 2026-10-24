import { NextResponse } from "next/server";
import { getSessionState, toPublicSession } from "@/lib/auth/session";
import { isOAuthConfigured } from "@/lib/config";

/** GET /api/auth/session — public session info (never the access token). */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!isOAuthConfigured()) return NextResponse.json({ authenticated: false, status: "none" }, { headers });
  const state = await getSessionState();
  if (state.status !== "active") {
    return NextResponse.json({ authenticated: false, status: state.status }, { headers });
  }
  return NextResponse.json({ authenticated: true, status: "active", ...toPublicSession(state.session) }, { headers });
}
