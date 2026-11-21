
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
      .from("events")
      .select(`
        id,
        title,
        description,
        event_date,
        organizer_id,
        event_format,
        poster_url,
        status,
        result,
        created_at
      `)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("Events loading failed:", error.message);

      return NextResponse.json(
        { error: "Could not load events" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, events: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Events GET error:", error);

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
      !("eventDate" in body)
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const input = body as {
      title: string;
      eventDate: string;
      description?: string;
      eventFormat?: string;
      posterUrl?: string;
    };

    if (
      typeof input.title !== "string" ||
      input.title.trim().length < 1 ||
      input.title.length > 120 ||
      typeof input.eventDate !== "string" ||
      !Number.isFinite(Date.parse(input.eventDate))
    ) {
      return NextResponse.json(
        { error: "Invalid event title or date" },
        { status: 400 }
      );
    }

    if (
      input.description !== undefined &&
      (typeof input.description !== "string" ||
        input.description.length > 5000)
    ) {
      return NextResponse.json(
        { error: "Invalid description" },
        { status: 400 }
      );
    }

    if (
      input.eventFormat !== undefined &&
      (typeof input.eventFormat !== "string" ||
        input.eventFormat.length > 100)
    ) {
      return NextResponse.json(
        { error: "Invalid event format" },
        { status: 400 }
      );
    }

    if (
      input.posterUrl !== undefined &&
      (typeof input.posterUrl !== "string" ||
        input.posterUrl.length > 2000 ||
        !/^https:\/\/\S+$/i.test(input.posterUrl))
    ) {
      return NextResponse.json(
        { error: "Poster must be a valid HTTPS URL" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("events")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        event_date: new Date(input.eventDate).toISOString(),
        organizer_id: user.telegramId,
        event_format: input.eventFormat?.trim() || null,
        poster_url: input.posterUrl || null
      })
      .select()
      .single();

    if (error) {
      console.error("Event creation failed:", error.message);

      return NextResponse.json(
        { error: "Could not create event" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, event: data },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Events POST error:", error);

    return NextResponse.json(
      { error: "Invalid request or internal server error" },
      { status: 400 }
    );
  }
}
