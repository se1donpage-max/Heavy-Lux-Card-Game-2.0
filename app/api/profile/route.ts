
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { readAllRows } from "@/lib/pagination";
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
    type Match = { id: string; title: string; played_at: string; placement: number };
    const stats = await readAllRows<{ match_id: string; kills: number; matches: Match | Match[] | null }>((from, to) => supabase
      .from("player_match_stats")
      .select("match_id, kills, matches(id, title, played_at, placement)")
      .eq("telegram_id", user.telegramId).order("id").range(from, to));
    const matchHistory = stats.flatMap((item) => {
      const match = Array.isArray(item.matches) ? item.matches[0] : item.matches;
      return match ? [{ id: match.id, title: match.title, playedAt: match.played_at,
        placement: match.placement, kills: item.kills }] : [];
    }).sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));

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
