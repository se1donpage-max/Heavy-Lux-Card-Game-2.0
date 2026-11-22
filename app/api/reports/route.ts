import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canManageContent } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
const fail = (message: string, status: number) => NextResponse.json({ success: false, error: message }, { status });

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  if (!canManageContent(user.accessRole)) return fail("Forbidden", 403);
  try {
    const { data, error } = await getSupabaseAdmin().from("community_reports")
      .select("id,author_id,subject,message,status,admin_reply,created_at,updated_at,profiles!community_reports_author_id_fkey(first_name,username)")
      .order("created_at", { ascending: false }).limit(200);
    if (error) { console.error("Report inbox GET", error); return fail("ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð·Ð°Ð³ÑÑÐ·Ð¸ÑÑ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ñ", 503); }
    return NextResponse.json({ success: true, reports: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Report inbox GET", error); return fail("Server error", 500); }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return fail("Request too large", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object") return fail("Invalid request", 400);
    const payload = body as Record<string, unknown>;
    const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!subject || subject.length > 80 || !message || message.length > 100) return fail("Ð¢ÐµÐ¼Ð° Ð´Ð¾ 80 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð², ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ Ð¾Ñ 1 Ð´Ð¾ 100", 400);
    const db = getSupabaseAdmin();
    // Basic server-side rate limit: at most three new reports in 10 minutes.
    const after = new Date(Date.now() - 600000).toISOString();
    const { count, error: countError } = await db.from("community_reports")
      .select("id", { count: "exact", head: true }).eq("author_id", user.telegramId).gte("created_at", after);
    if (countError) return fail("ÐÐ¾Ð¿ÑÐ¾Ð±ÑÐ¹ÑÐµ Ð¿Ð¾Ð²ÑÐ¾ÑÐ¸ÑÑ Ð¿Ð¾Ð·Ð´Ð½ÐµÐµ", 503);
    if ((count ?? 0) >= 3) return fail("ÐÐµ Ð±Ð¾Ð»ÐµÐµ ÑÑÑÑ Ð¾Ð±ÑÐ°ÑÐµÐ½Ð¸Ð¹ Ð·Ð° 10 Ð¼Ð¸Ð½ÑÑ", 429);
    const { error } = await db.from("community_reports").insert({ author_id: user.telegramId, subject, message });
    if (error) { console.error("Report insert failed", error); return fail("ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾ÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð¾Ð±ÑÐ°ÑÐµÐ½Ð¸Ðµ", 503); }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) { console.error("Report POST", error); return fail("ÐÐµÐºÐ¾ÑÑÐµÐºÑÐ½ÑÐ¹ Ð·Ð°Ð¿ÑÐ¾Ñ", 400); }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  if (!canManageContent(user.accessRole)) return fail("Forbidden", 403);
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return fail("Invalid request", 400);
    const data = body as Record<string, unknown>;
    if (typeof data.id !== "string" || !uuid.test(data.id) ||
        typeof data.status !== "string" || !statuses.includes(data.status as typeof statuses[number]) ||
        typeof data.reply !== "string" || data.reply.length > 500) return fail("Invalid report data", 400);
    const { data: updated, error } = await getSupabaseAdmin().from("community_reports")
      .update({ status: data.status, admin_reply: data.reply.trim() || null, handled_by: user.telegramId })
      .eq("id", data.id).select("id").maybeSingle();
    if (error) { console.error("Report update", error); return fail("ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾Ð±Ð½Ð¾Ð²Ð¸ÑÑ Ð¾Ð±ÑÐ°ÑÐµÐ½Ð¸Ðµ", 503); }
    if (!updated) return fail("ÐÐ±ÑÐ°ÑÐµÐ½Ð¸Ðµ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾", 404);
    return NextResponse.json({ success: true });
  } catch { return fail("Invalid request", 400); }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  if (!canManageContent(user.accessRole)) return fail("Forbidden", 403);
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !uuid.test(body.id)) return fail("Invalid ID", 400);
    const { data, error } = await getSupabaseAdmin().from("community_reports").delete().eq("id", body.id).select("id").maybeSingle();
    if (error) { console.error("Report deletion", error); return fail("ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ ÑÐ´Ð°Ð»Ð¸ÑÑ Ð¾Ð±ÑÐ°ÑÐµÐ½Ð¸Ðµ", 503); }
    if (!data) return fail("ÐÐ±ÑÐ°ÑÐµÐ½Ð¸Ðµ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾", 404);
    return NextResponse.json({ success: true });
  } catch { return fail("Invalid request", 400); }
}
