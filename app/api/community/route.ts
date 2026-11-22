import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Number of distinct Telegram accounts registered in K7 CREW, not online presence. */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const { count, error } = await getSupabaseAdmin()
      .from("profiles")
      .select("telegram_id", { head: true, count: "exact" });
    if (error || count === null) {
      console.error("Community count failed", error);
      return NextResponse.json({ success: false, error: "Не удалось загрузить участников" }, { status: 503 });
    }
    return NextResponse.json({ success: true, count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Community GET failed", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
