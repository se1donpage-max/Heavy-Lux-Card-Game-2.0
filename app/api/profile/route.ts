
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Получаем игровую информацию участника
    const { data: roster, error: rosterError } = await supabase
      .from("roster")
      .select("slot, game_role, in_game_id, is_captain")
      .eq("telegram_id", user.telegramId)
      .maybeSingle();

    if (rosterError) {
      throw rosterError;
    }

    // Получаем только статистику матчей, в которых игрок участвовал
    const { data: playerStats, error: statsError } = await supabase
      .from("player_match_stats")
      .select("match_id, kills")
      .eq("telegram_id", user.telegramId);

    if (statsError) {
      throw statsError;
    }

    const stats = playerStats ?? [];
    const matchIds = stats.map((item) => item.match_id);

    let matchHistory: {
      id: string;
      title: string;
      playedAt: string;
      placement: number;
      kills: number;
    }[] = [];

    if (matchIds.length > 0) {
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id, title, played_at, placement")
        .in("id", matchIds)
        .order("played_at", { ascending: false });

      if (matchesError) {
        throw matchesError;
      }

      const killsByMatch = new Map(
        stats.map((item) => [item.match_id, item.kills])
      );

      matchHistory = (matches ?? []).map((match) => ({
        id: match.id,
        title: match.title,
        playedAt: match.played_at,
        placement: match.placement,
        kills: killsByMatch.get(match.id) ?? 0
      }));
    }

    const totalMatches = matchHistory.length;
    const totalKills = stats.reduce(
      (sum, item) => sum + item.kills,
      0
    );
    const totalWins = matchHistory.filter(
      (match) => match.placement === 1
    ).length;

    const teamStatus = !roster
      ? "Участник сообщества"
      : roster.is_captain
        ? "Капитан"
        : "Игрок состава";

    return NextResponse.json(
      {
        success: true,
        profile: {
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          photoUrl: user.photoUrl,
          accessRole: user.accessRole,
          teamStatus,
          gameRole: roster?.game_role ?? null,
          slot: roster?.slot ?? null,
          inGameId: roster?.in_game_id ?? null,
          isCaptain: roster?.is_captain ?? false
        },
        statistics: {
          matches: totalMatches,
          wins: totalWins,
          kills: totalKills,
          winRate: totalMatches > 0
            ? Number(((totalWins / totalMatches) * 100).toFixed(1))
            : 0,
          killsPerMatch: totalMatches > 0
            ? Number((totalKills / totalMatches).toFixed(2))
            : 0
        },
        matchHistory
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Profile API error:", error);

    return NextResponse.json(
      { success: false, error: "Не удалось загрузить профиль" },
      { status: 500 }
    );
  }
}
