import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { readAllRows } from "@/lib/pagination";
import { communityPosition, membershipDays, parseCommunityProfile } from "@/lib/community-profile";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: string, status: number) => reply({ success: false, error }, status);
export async function GET(request: NextRequest) {
  const viewer = await getAuthenticatedUser();
  if (!viewer) return fail("Необходима авторизация", 401);
  const raw = request.nextUrl.searchParams.get("id");
  const id = raw === null ? viewer.telegramId : Number(raw);
  if ((raw !== null && !/^\d+$/.test(raw)) || !Number.isSafeInteger(id) || id <= 0) return fail("Некорректный ID", 400);
  try {
    const db = getSupabaseAdmin();
    const {data:p,error} = await db.from("profiles").select("telegram_id,username,first_name,photo_url,access_role,created_at,game_id,game_nickname,display_name,age_years,show_name,show_age").eq("telegram_id",id).maybeSingle();
    if(error) throw error;
    if(!p) return fail("Участник не найден",404);
    const {data:r,error:re} = await db.from("roster").select("slot,game_role,is_captain,in_game_id").eq("telegram_id",id).maybeSingle();
    if(re) throw re;
    type Match = { placement: number };
    const rows = await readAllRows<{ kills: number; matches: Match | Match[] | null }>((from,to)=>db.from("player_match_stats").select("kills,matches(placement)").eq("telegram_id",id).order("id").range(from,to));
    const matches = rows.length, kills = rows.reduce((sum,row)=>sum+row.kills,0), wins = rows.filter(row=>(Array.isArray(row.matches)?row.matches[0]:row.matches)?.placement===1).length;
    const own = viewer.telegramId === id;
    return reply({success:true, profile:{telegramId:id, username:p.username, telegramName:p.first_name, photoUrl:p.photo_url, own,
      position:communityPosition(p.access_role,r?.slot,r?.is_captain), gameRole:r?.game_role??null, slot:r?.slot??null,
      createdAt:p.created_at, days:membershipDays(p.created_at), gameId:p.game_id??null, gameNickname:p.game_nickname,
      displayName:own||p.show_name?p.display_name:null, ageYears:own||p.show_age?p.age_years:null,
      ...(own?{showName:p.show_name,showAge:p.show_age}:{}), statistics:{matches,wins,kills,winRate:matches?Math.round(wins/matches*1000)/10:0}}});
  } catch(error) { console.error("Community profile GET",error); return fail("Не удалось загрузить профиль",503); }
}
export async function PATCH(request: NextRequest) {
  const viewer = await getAuthenticatedUser();
  if(!viewer) return fail("Необходима авторизация",401);
  try {
    const raw=await request.text(); if(raw.length>4096) return fail("Запрос слишком большой",413);
    let parsed:unknown; try { parsed=JSON.parse(raw); } catch { return fail("Некорректные данные",400); }
    const p=parseCommunityProfile(parsed); if(!p) return fail("Проверьте поля профиля",400);
    const {error}=await getSupabaseAdmin().from("profiles").update({game_id:p.gameId||null,game_nickname:p.gameNickname||null,display_name:p.displayName||null,age_years:p.ageYears,show_name:p.showName,show_age:p.showAge,updated_at:new Date().toISOString()}).eq("telegram_id",viewer.telegramId);
    if(error) throw error;
    return reply({success:true});
  } catch(error) { console.error("Community profile PATCH",error); return fail("Не удалось сохранить профиль",503); }
}
