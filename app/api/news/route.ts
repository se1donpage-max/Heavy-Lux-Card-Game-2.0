
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canManageContent } from "@/lib/permissions";

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
      .from("news")
      .select(`
        id,
        title,
        content,
        cover_url,
        author_id,
        published_at,
        created_at
      `)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("News loading failed:", error.message);

      return NextResponse.json(
        { error: "Could not load news" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, news: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("News GET error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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

    if (!canManageContent(user.accessRole)) {
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
      !("content" in body)
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const input = body as {
      title: string;
      content: string;
      coverUrl?: string;
      publishedAt?: string;
    };

    if (
      typeof input.title !== "string" ||
      input.title.trim().length < 1 ||
      input.title.length > 150 ||
      typeof input.content !== "string" ||
      input.content.trim().length < 1 ||
      input.content.length > 20000
    ) {
      return NextResponse.json(
        { error: "Invalid title or content" },
        { status: 400 }
      );
    }

    if (
      input.coverUrl !== undefined &&
      (typeof input.coverUrl !== "string" ||
        input.coverUrl.length > 2000 ||
        !/^https:\/\/\S+$/i.test(input.coverUrl))
    ) {
      return NextResponse.json(
        { error: "Cover must be a valid HTTPS URL" },
        { status: 400 }
      );
    }

    if (
      input.publishedAt !== undefined &&
      (typeof input.publishedAt !== "string" ||
        !Number.isFinite(Date.parse(input.publishedAt)))
    ) {
      return NextResponse.json(
        { error: "Invalid publication date" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("news")
      .insert({
        title: input.title.trim(),
        content: input.content.trim(),
        cover_url: input.coverUrl || null,
        author_id: user.telegramId,
        published_at: input.publishedAt
          ? new Date(input.publishedAt).toISOString()
          : new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("News creation failed:", error.message);

      return NextResponse.json(
        { error: "Could not publish news" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, news: data },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("News POST error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}
