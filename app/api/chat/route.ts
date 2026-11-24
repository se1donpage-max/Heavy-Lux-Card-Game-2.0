
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canManageContent } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_LIMIT = 1000;
const MESSAGE_LIFETIME_MINUTES = 10;
const PAGE_SIZE = 50;

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const params = request.nextUrl.searchParams;
    const beforeCreatedAt = params.get("beforeCreatedAt");
    const beforeId = params.get("beforeId");

    if (
      (beforeCreatedAt && !beforeId) ||
      (!beforeCreatedAt && beforeId)
    ) {
      return jsonError("Invalid pagination cursor", 400);
    }

    if (
      beforeCreatedAt &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(beforeCreatedAt) ||
        Number.isNaN(Date.parse(beforeCreatedAt)) ||
        !beforeId ||
        !uuidPattern.test(beforeId))
    ) {
      return jsonError("Invalid pagination cursor", 400);
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
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
        ),
        chat_reactions (*)
      `)
      .gt("expires_at", new Date().toISOString());

    if (beforeCreatedAt && beforeId) {
      query = query.or(
        `created_at.lt.${beforeCreatedAt},and(created_at.eq.${beforeCreatedAt},id.lt.${beforeId})`
      );
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (error) {
      console.error("Chat GET failed:", error);
      return jsonError("Could not load messages", 503);
    }

    const rows = data ?? [];
    const hasMore = rows.length > PAGE_SIZE;

    const messages = rows
      .slice(0, PAGE_SIZE)
      .reverse()
      .map((row) => ({
        ...row,
        chat_reactions: (row.chat_reactions ?? []).map((item) => {
          // Original schema uses emoji;
          // some deployed databases use reaction.
          const reaction = item as typeof item & {
            emoji?: string;
            reaction?: string;
          };

          return {
            id: reaction.id,
            telegram_id: reaction.telegram_id,
            reaction:
              reaction.reaction ?? reaction.emoji ?? "",
          };
        }),
      }));

    return NextResponse.json({
      success: true,
      messages,
      hasMore,
      currentUserId: user.telegramId,
    });
  } catch (error) {
    console.error("Chat GET error:", error);
    return jsonError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const bodyText = await request.text();

    if (bodyText.length > 5000) {
      return jsonError("Request too large", 413);
    }

    let body: unknown;

    try {
      body = JSON.parse(bodyText);
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    if (typeof body !== "object" || body === null) {
      return jsonError("Invalid message data", 400);
    }

    const content =
      "content" in body && typeof body.content === "string"
        ? body.content.trim()
        : "";

    const replyTo =
      "replyTo" in body &&
      typeof body.replyTo === "string" &&
      body.replyTo.length > 0
        ? body.replyTo
        : null;

    if (!content || content.length > MESSAGE_LIMIT) {
      return jsonError(
        "Message must contain 1–1000 characters",
        400
      );
    }

    if (replyTo && !uuidPattern.test(replyTo)) {
      return jsonError("Invalid reply reference", 400);
    }

    const supabase = getSupabaseAdmin();

    if (replyTo) {
      const { data: parentMessage, error: parentError } =
        await supabase
          .from("chat_messages")
          .select("id")
          .eq("id", replyTo)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

      if (parentError) {
        console.error("Reply lookup failed:", parentError);
        return jsonError("Could not verify reply", 503);
      }

      if (!parentMessage) {
        return jsonError(
          "Original message not found or expired",
          404
        );
      }
    }

    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() +
        MESSAGE_LIFETIME_MINUTES * 60 * 1000
    );

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        telegram_id: user.telegramId,
        content,
        reply_to: replyTo,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
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
      .single();

    if (error) {
      console.error(
        "Chat message creation failed:",
        error
      );
      return jsonError("Could not send message", 503);
    }

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        chat_reactions: [],
      },
    });
  } catch (error) {
    console.error("Chat POST error:", error);
    return jsonError("Internal server error", 500);
  }
}

// Moderation requests never trust a client-supplied admin flag.
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return jsonError("Unauthorized", 401);
    if (!canManageContent(user.accessRole)) return jsonError("Forbidden", 403);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return jsonError("Invalid payload", 400);
    }

    const action = body as { id?: unknown; all?: unknown };

    if (
      action.all !== true &&
      (typeof action.id !== "string" || !uuidPattern.test(action.id))
    ) {
      return jsonError("Invalid message ID", 400);
    }

    const db = getSupabaseAdmin();

    const operation = action.all === true
      ? db.from("chat_messages")
          .delete()
          .gt("expires_at", new Date(0).toISOString())
      : db.from("chat_messages")
          .delete()
          .eq("id", action.id as string);

    const { error } = await operation;

    if (error) {
      return jsonError("Could not delete messages", 503);
    }

    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Invalid request", 400);
  }
}
