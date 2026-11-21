
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("roster")
      .select(`
        id,
        telegram_id,
        slot,
        game_role,
        in_game_id,
        is_captain,
        joined_at,
        profiles (
          first_name,
          last_name,
          username,
          photo_url
        )
      `)
      .order("slot", { ascending: true });

    if (error) {
      console.error("Roster loading failed:", error.message);

      return NextResponse.json(
        { error: "Could not load roster" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        roster: data ?? []
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Roster API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
