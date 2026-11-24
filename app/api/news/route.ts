import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canManageContent } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedStyles = ["editorial", "statement", "spotlight"];
const fail = (message: string, status: number) => NextResponse.json({ success: false, error: message }, { status });

function httpsUrl(value: string): boolean {
  if (!value) return true;
  if (value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}

function parseNews(value: unknown): { value?: Record<string, string | boolean | null>; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid payload" };
  const input = value as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const subtitle = typeof input.subtitle === "string" ? input.subtitle.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "НОВОСТИ";
  const coverUrl = typeof input.coverUrl === "string" ? input.coverUrl.trim() : "";
  const ctaLabel = typeof input.ctaLabel === "string" ? input.ctaLabel.trim() : "";
  const ctaUrl = typeof input.ctaUrl === "string" ? input.ctaUrl.trim() : "";
  const layoutStyle = typeof input.layoutStyle === "string" ? input.layoutStyle : "editorial";
  const pinned = input.pinned === true;
  if (!title || title.length > 150 || !content || content.length > 20000 ||
      subtitle.length > 220 || category.length > 35 || !category ||
      ctaLabel.length > 48 || !allowedStyles.includes(layoutStyle) ||
      !httpsUrl(coverUrl) || !httpsUrl(ctaUrl) || (!!ctaLabel !== !!ctaUrl)) {
    return { error: "Проверьте заголовок, описание, оформление и HTTPS-ссылки" };
  }
  return { value: {
    title, content, subtitle: subtitle || null, category, cover_url: coverUrl || null,
    layout_style: layoutStyle, is_pinned: pinned, cta_label: ctaLabel || null, cta_url: ctaUrl || null,
  } };
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  try {
    const { data, error } = await getSupabaseAdmin().from("news")
      .select("id,title,subtitle,category,content,cover_url,layout_style,is_pinned,cta_label,cta_url,published_at,created_at")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false }).limit(100);
    if (error) { console.error("News GET", error); return fail("Не удалось загрузить новости. Проверьте миграцию 004.", 503); }
    return NextResponse.json({ success: true, news: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("News GET", error); return fail("Server error", 500); }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  if (!canManageContent(user.accessRole)) return fail("Forbidden", 403);
  try {
    const raw = await request.text();
    if (raw.length > 30000) return fail("Request too large", 413);
    const parsed = parseNews(JSON.parse(raw));
    if (!parsed.value) return fail(parsed.error ?? "Invalid payload", 400);
    const { data, error } = await getSupabaseAdmin().from("news")
      .insert({ ...parsed.value, author_id: user.telegramId })
      .select("id").single();
    if (error) { console.error("News POST", error); return fail("Не удалось создать публикацию", 503); }
    return NextResponse.json({ success: true, news: data }, { status: 201 });
  } catch { return fail("Некорректный запрос", 400); }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  if (!canManageContent(user.accessRole)) return fail("Forbidden", 403);
  try {
    const raw = await request.text();
    if (raw.length > 30000) return fail("Request too large", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || !('id' in body) || typeof body.id !== "string" || !uuid.test(body.id)) return fail("Invalid news ID", 400);
    const parsed = parseNews(body);
    if (!parsed.value) return fail(parsed.error ?? "Invalid payload", 400);
    const { data, error } = await getSupabaseAdmin().from("news")
      .update(parsed.value).eq("id", body.id).select("id").maybeSingle();
    if (error) { console.error("News PATCH", error); return fail("Не удалось сохранить публикацию", 503); }
    if (!data) return fail("Новость не найдена", 404);
    return NextResponse.json({ success: true });
  } catch { return fail("Некорректный запрос", 400); }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return fail("Unauthorized", 401);
  if (!canManageContent(user.accessRole)) return fail("Forbidden", 403);
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !('id' in body) || typeof body.id !== "string" || !uuid.test(body.id)) return fail("Invalid news ID", 400);
    const { data, error } = await getSupabaseAdmin().from("news")
      .delete().eq("id", body.id).select("id").maybeSingle();
    if (error) { console.error("News DELETE", error); return fail("Не удалось удалить новость", 503); }
    if (!data) return fail("Новость уже удалена или не найдена", 404);
    return NextResponse.json({ success: true });
  } catch { return fail("Некорректный запрос", 400); }
}
