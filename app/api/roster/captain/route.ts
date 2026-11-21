
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canManageRoster } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!canManageRoster(user.accessRole)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("telegramId" in body) ||
      typeof body.telegramId !== "number" ||
      !Number.isSafeInteger(body.telegramId) ||
      body.telegramId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid Telegram ID" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: player, error: playerError } = await supabase
      .from("roster")
      .select("telegram_id")
      .eq("telegram_id", body.telegramId)
      .maybeSingle();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Player not found in roster" },
        { status: 404 }
      );
    }

    const { error } = await supabase.rpc(
      "set_team_captain",
      {
        target_telegram_id: body.telegramId
      }
    );

    if (error) {
      console.error("Captain assignment failed:", error.message);

      return NextResponse.json(
        { error: "Could not assign captain" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Captain API error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}
