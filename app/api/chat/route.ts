
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

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
      .from("chat_messages")
      .select(`
        id,
        telegram_id,
        content,
        reply_to,
        created_at,
        expires_at,
        profiles (
          first_name,
          last_name,
          username,
          photo_url
        )
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Chat loading failed:", error.message);

      return NextResponse.json(
        { error: "Could not load messages" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        messages: data ?? []
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Chat GET error:", error);

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

    const bodyText = await request.text();

    if (bodyText.length > 10000) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413 }
      );
    }

    const body: unknown = JSON.parse(bodyText);

    if (
      typeof body !== "object" ||
      body === null ||
      !("content" in body) ||
      typeof body.content !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid message" },
        { status: 400 }
      );
    }

    const content = body.content.trim();

    if (content.length < 1 || content.length > 1000) {
      return NextResponse.json(
        { error: "Message must contain 1–1000 characters" },
        { status: 400 }
      );
    }

    let replyTo: string | null = null;

    if ("replyTo" in body && body.replyTo !== null) {
      if (
        typeof body.replyTo !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          body.replyTo
        )
      ) {
        return NextResponse.json(
          { error: "Invalid reply reference" },
          { status: 400 }
        );
      }

      replyTo = body.replyTo;
    }

    const supabase = getSupabaseAdmin();

    if (replyTo) {
      const { data: originalMessage, error: replyError } =
        await supabase
          .from("chat_messages")
          .select("id")
          .eq("id", replyTo)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

      if (replyError || !originalMessage) {
        return NextResponse.json(
          { error: "Original message not found or expired" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        telegram_id: user.telegramId,
        content,
        reply_to: replyTo
      })
      .select(`
        id,
        telegram_id,
        content,
        reply_to,
        created_at,
        expires_at
      `)
      .single();

    if (error || !data) {
      console.error("Message creation failed:", error?.message);

      return NextResponse.json(
        { error: "Could not send message" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: data
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Chat POST error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}
