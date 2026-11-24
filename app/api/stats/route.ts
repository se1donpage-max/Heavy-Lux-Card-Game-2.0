
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { readAllRows } from "@/lib/pagination";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Profile = { first_name: string; last_name: string | null; username: string | null; photo_url: string | null };

type PlayerStats = {
  telegramId: number;
  name: string;
  photoUrl: string | null;
  slot: string | null;
  matches: number;
  wins: number;
  kills: number;
  winRate: number;
  killsPerMatch: number;
};

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

    const [matchList, rows, rosterList] = await Promise.all([
      readAllRows<{ id: string; title: string; played_at: string; placement: number }>((from, to) => supabase.from("matches")
        .select("id, title, played_at, placement")
        .order("played_at", { ascending: false }).order("id").range(from, to)),
      readAllRows<{ match_id: string; telegram_id: number; kills: number }>((from, to) => supabase.from("player_match_stats")
        .select("match_id, telegram_id, kills").order("id").range(from, to)),
      readAllRows<{ telegram_id: number; slot: string; profiles: Profile | Profile[] | null }>((from, to) => supabase.from("roster")
        .select(`telegram_id, slot, profiles(first_name, last_name, username, photo_url)`)
        .order("id").range(from, to))
    ]);

    const matchMap = new Map(
      matchList.map((match) => [match.id, match])
    );

    const statsMap = new Map<number, PlayerStats>();

    for (const player of rosterList) {
      const telegramId = Number(player.telegram_id);
      const profile = Array.isArray(player.profiles)
        ? player.profiles[0]
        : player.profiles;

      const name =
        profile?.username
          ? `@${profile.username}`
          : [profile?.first_name, profile?.last_name]
              .filter(Boolean)
              .join(" ") || "Участник";

      statsMap.set(telegramId, {
        telegramId,
        name,
        photoUrl: profile?.photo_url ?? null,
        slot: player.slot,
        matches: 0,
        wins: 0,
        kills: 0,
        winRate: 0,
        killsPerMatch: 0
      });
    }

    for (const row of rows) {
      const telegramId = Number(row.telegram_id);
      const stats = statsMap.get(telegramId);
      const match = matchMap.get(row.match_id);

      if (!stats || !match) continue;

      stats.matches += 1;
      stats.kills += row.kills;

      if (match.placement === 1) {
        stats.wins += 1;
      }
    }

    for (const stats of statsMap.values()) {
      stats.winRate = stats.matches > 0
        ? Number(((stats.wins / stats.matches) * 100).toFixed(2))
        : 0;

      stats.killsPerMatch = stats.matches > 0
        ? Number((stats.kills / stats.matches).toFixed(2))
        : 0;
    }

    const ranking = (players: PlayerStats[]) =>
      [...players].sort(
        (a, b) =>
          b.wins - a.wins ||
          b.kills - a.kills ||
          b.matches - a.matches
      );

    const allPlayers = [...statsMap.values()];

    const mainPlayers = allPlayers.filter(
      (player) => player.slot?.startsWith("MAIN_")
    );

    const subPlayers = allPlayers.filter(
      (player) => player.slot?.startsWith("SUB_")
    );

    const totalKills = rows.reduce(
      (sum, row) => sum + row.kills,
      0
    );

    const totalWins = matchList.filter(
      (match) => match.placement === 1
    ).length;

    return NextResponse.json(
      {
        success: true,
        team: {
          matches: matchList.length,
          wins: totalWins,
          kills: totalKills,
          winRate: matchList.length > 0
            ? Number(((totalWins / matchList.length) * 100).toFixed(2))
            : 0
        },
        rankings: {
          overall: ranking(allPlayers),
          main: ranking(mainPlayers),
          sub: ranking(subPlayers)
        },
        recentMatches: matchList.slice(0, 10)
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Stats API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
