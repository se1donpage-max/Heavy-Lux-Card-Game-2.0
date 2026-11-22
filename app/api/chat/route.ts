
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REACTIONS = ["🔥", "❤️", "👍", "👎"] as const;

type Reaction = (typeof ALLOWED_REACTIONS)[number];

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

    if (bodyText.length > 2000) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413 }
      );
    }

    const body: unknown = JSON.parse(bodyText);

    if (
      typeof body !== "object" ||
      body === null ||
      !("messageId" in body) ||
      typeof body.messageId !== "string" ||
      !("reaction" in body) ||
      typeof body.reaction !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid reaction data" },
        { status: 400 }
      );
    }

    const messageId = body.messageId;
    const reaction = body.reaction as Reaction;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        messageId
      ) ||
      !ALLOWED_REACTIONS.includes(reaction)
    ) {
      return NextResponse.json(
        { error: "Invalid message or reaction" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: message, error: messageError } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("id", messageId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "Message not found or expired" },
        { status: 404 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("chat_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("telegram_id", user.telegramId)
      .eq("reaction", reaction)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "Could not check reaction" },
        { status: 503 }
      );
    }

    if (existing) {
      const { error } = await supabase
        .from("chat_reactions")
        .delete()
        .eq("id", existing.id)
        .eq("telegram_id", user.telegramId);

      if (error) {
        return NextResponse.json(
          { error: "Could not remove reaction" },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "removed"
      });
    }

    const { error } = await supabase
      .from("chat_reactions")
      .insert({
        message_id: messageId,
        telegram_id: user.telegramId,
        reaction
      });

    if (error) {
      console.error("Reaction creation failed:", error.message);

      return NextResponse.json(
        { error: "Could not add reaction" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "added"
    });
  } catch (error) {
    console.error("Reaction API error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}
