
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  validateRosterInput,
  type RosterInput
} from "@/lib/roster";
import { canManageRoster } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Публичный просмотр состава
export async function GET() {
  try {
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
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Roster GET error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Добавление игрока — только администратор
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
      !("slot" in body) ||
      !("gameRole" in body)
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const input = body as RosterInput;

    if (input.isCaptain === true) {
      return NextResponse.json(
        { error: "Assign captain separately" },
        { status: 400 }
      );
    }

    const validationError = validateRosterInput(input);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("telegram_id")
      .eq("telegram_id", input.telegramId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: "User profile not found. The user must open the app first."
        },
        { status: 404 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("roster")
      .select("id")
      .eq("telegram_id", input.telegramId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "Could not check existing roster entry" },
        { status: 503 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "This user is already in the roster" },
        { status: 409 }
      );
    }

    const { data: created, error } = await supabase
      .from("roster")
      .insert({
        telegram_id: input.telegramId,
        slot: input.slot,
        game_role: input.gameRole,
        in_game_id: input.inGameId ?? null,
        is_captain: false
      })
      .select()
      .single();

    if (error) {
      console.error("Roster insert failed:", error.message);

      return NextResponse.json(
        {
          error: "Could not add player. The slot may already be occupied."
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        player: created
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Roster POST error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}

// Удаление игрока — только администратор
export async function DELETE(request: NextRequest) {
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

    const { error } = await supabase
      .from("roster")
      .delete()
      .eq("telegram_id", body.telegramId);

    if (error) {
      console.error("Roster delete failed:", error.message);

      return NextResponse.json(
        { error: "Could not remove player" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Roster DELETE error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}
