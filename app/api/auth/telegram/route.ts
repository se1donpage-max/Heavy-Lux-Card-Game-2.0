
import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram";
import { createSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    if (bodyText.length > 20000) {
      return NextResponse.json(
        { success: false, error: "Request too large" },
        { status: 413 }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("initData" in body) ||
      typeof body.initData !== "string" ||
      !body.initData.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid Telegram data" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN is missing");

      return NextResponse.json(
        { success: false, error: "Authentication service unavailable" },
        { status: 503 }
      );
    }

    const verified = verifyTelegramInitData(
      body.initData,
      botToken
    );

    if (!verified?.user) {
      return NextResponse.json(
        { success: false, error: "Telegram authentication failed" },
        { status: 401 }
      );
    }

    const telegramUser = verified.user;
    const supabase = getSupabaseAdmin();

    const profile = {
      telegram_id: telegramUser.id,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
      photo_url: telegramUser.photo_url ?? null,
      access_role: "MEMBER",
    };

    const { error: insertError } = await supabase
      .from("profiles")
      .upsert(profile, {
        onConflict: "telegram_id",
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error("Profile creation failed:", insertError);

      return NextResponse.json(
        { success: false, error: "Could not create profile" },
        { status: 503 }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        username: profile.username,
        photo_url: profile.photo_url,
      })
      .eq("telegram_id", telegramUser.id);

    if (updateError) {
      console.error("Profile update failed:", updateError);

      return NextResponse.json(
        { success: false, error: "Could not update profile" },
        { status: 503 }
      );
    }

    // Assign MEMBER only when the profile has no role.
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ access_role: "MEMBER" })
      .eq("telegram_id", telegramUser.id)
      .is("access_role", null);

    if (roleError) {
      console.error("Default role assignment failed:", roleError);

      return NextResponse.json(
        { success: false, error: "Could not configure profile role" },
        { status: 503 }
      );
    }

    const ownerId = process.env.TELEGRAM_OWNER_ID;

    if (
      ownerId &&
      /^\d+$/.test(ownerId) &&
      Number(ownerId) === telegramUser.id
    ) {
      const { error: ownerError } = await supabase
        .from("profiles")
        .update({ access_role: "OWNER" })
        .eq("telegram_id", telegramUser.id);

      if (ownerError) {
        console.error("Owner assignment failed:", ownerError);

        return NextResponse.json(
          { success: false, error: "Could not configure owner access" },
          { status: 503 }
        );
      }
    }

    const user = {
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      photoUrl: telegramUser.photo_url,
    };

    const session = createSession(user);

    const response = NextResponse.json({
      success: true,
      user,
    });

    response.cookies.set("k7_session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Telegram authentication error:", error);

    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
