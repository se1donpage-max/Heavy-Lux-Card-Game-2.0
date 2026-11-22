
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canSubmitMatchResults } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MatchInput {
  title: string;
  playedAt: string;
  placement: number;
  players: {
    telegramId: number;
    kills: number;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!canSubmitMatchResults(user.accessRole)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("title" in body) ||
      !("playedAt" in body) ||
      !("placement" in body) ||
      !("players" in body)
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const input = body as MatchInput;

    if (
      typeof input.title !== "string" ||
      input.title.trim().length < 1 ||
      input.title.length > 100 ||
      typeof input.playedAt !== "string" ||
      !Number.isFinite(Date.parse(input.playedAt)) ||
      !Number.isInteger(input.placement) ||
      input.placement < 1 ||
      input.placement > 100 ||
      !Array.isArray(input.players) ||
      input.players.length < 1 ||
      input.players.length > 4
    ) {
      return NextResponse.json(
        { error: "Invalid match data" },
        { status: 400 }
      );
    }

    const seen = new Set<number>();

    for (const player of input.players) {
      if (
        !Number.isSafeInteger(player.telegramId) ||
        player.telegramId <= 0 ||
        !Number.isInteger(player.kills) ||
        player.kills < 0 ||
        player.kills > 100 ||
        seen.has(player.telegramId)
      ) {
        return NextResponse.json(
          { error: "Invalid player statistics" },
          { status: 400 }
        );
      }

      seen.add(player.telegramId);
    }

    const supabase = getSupabaseAdmin();

    const { data: rosterPlayers, error: rosterError } =
      await supabase
        .from("roster")
        .select("telegram_id")
        .in("telegram_id", input.players.map((p) => p.telegramId));

    if (rosterError) {
      return NextResponse.json(
        { error: "Could not verify players" },
        { status: 503 }
      );
    }

    if (
      !rosterPlayers ||
      rosterPlayers.length !== input.players.length
    ) {
      return NextResponse.json(
        { error: "One or more players are not in the roster" },
        { status: 400 }
      );
    }

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        title: input.title.trim(),
        played_at: new Date(input.playedAt).toISOString(),
        placement: input.placement,
        created_by: user.telegramId
      })
      .select("id, title, played_at, placement")
      .single();

    if (matchError || !match) {
      console.error("Match creation failed:", matchError?.message);

      return NextResponse.json(
        { error: "Could not create match" },
        { status: 503 }
      );
    }

    const stats = input.players.map((player) => ({
      match_id: match.id,
      telegram_id: player.telegramId,
      kills: player.kills
    }));

    const { error: statsError } = await supabase
      .from("player_match_stats")
      .insert(stats);

    if (statsError) {
      console.error("Match stats creation failed:", statsError.message);

      await supabase
        .from("matches")
        .delete()
        .eq("id", match.id);

      return NextResponse.json(
        { error: "Could not save match statistics" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        match
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Match API error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}


const matchEditIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canSubmitMatchResults(user.accessRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (typeof input.id !== "string" || !matchEditIdPattern.test(input.id) ||
        typeof input.title !== "string" || !input.title.trim() || input.title.length > 100 ||
        typeof input.playedAt !== "string" || !Number.isFinite(Date.parse(input.playedAt)) ||
        typeof input.placement !== "number" || !Number.isInteger(input.placement) || input.placement < 1 || input.placement > 100) {
      return NextResponse.json({ error: "Invalid match details" }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin().from("matches").update({
      title: input.title.trim(), played_at: new Date(input.playedAt).toISOString(), placement: input.placement
    }).eq("id", input.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Could not update match" }, { status: 503 });
    if (!data) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canSubmitMatchResults(user.accessRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !matchEditIdPattern.test(body.id))
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("matches").delete().eq("id", body.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Could not delete match" }, { status: 503 });
    if (!data) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
