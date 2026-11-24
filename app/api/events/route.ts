
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isK7Media } from "@/lib/publication-templates";
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
        (!/^https:\/\/\S+$/i.test(input.posterUrl) && !isK7Media(input.posterUrl)))
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

// Change event state without altering the published event details.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageContent(user.accessRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" ||
      !("id" in body) || typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id) ||
      !("status" in body) || (body.status !== "COMPLETED" && body.status !== "CANCELLED" && body.status !== "UPCOMING")) {
      return NextResponse.json({ error: "Invalid event status" }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("events")
      .update({ status: body.status })
      .eq("id", body.id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Event status update failed:", error);
      return NextResponse.json({ error: "Could not update event" }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ success: true, event: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Event PATCH error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}


// Edit published event details (owner/captain only; verified on the server).
const adminIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({error:"Unauthorized"}, {status:401});
    if (!canManageContent(user.accessRole)) return NextResponse.json({error:"Forbidden"}, {status:403});
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({error:"Invalid payload"}, {status:400});
    const input = body as Record<string,unknown>;
    if (typeof input.id !== "string" || !adminIdPattern.test(input.id) ||
        typeof input.title !== "string" || !input.title.trim() || input.title.length > 120 ||
        typeof input.eventDate !== "string" || !Number.isFinite(Date.parse(input.eventDate)) ||
        typeof input.description !== "string" || input.description.length > 5000 ||
        typeof input.eventFormat !== "string" || input.eventFormat.length > 100 ||
        typeof input.posterUrl !== "string" || input.posterUrl.length > 2000 ||
        (input.posterUrl.length > 0 && (!/^https:\/\/\S+$/i.test(input.posterUrl) && !isK7Media(input.posterUrl)))) {
      return NextResponse.json({error:"Invalid event data"}, {status:400});
    }
    const {data,error}=await getSupabaseAdmin().from("events").update({
      title:input.title.trim(), event_date:new Date(input.eventDate).toISOString(),
      description:input.description.trim() || null, event_format:input.eventFormat.trim() || null,
      poster_url:input.posterUrl || null, updated_at:new Date().toISOString()
    }).eq("id",input.id).select("id").maybeSingle();
    if(error) return NextResponse.json({error:"Could not edit event"}, {status:503});
    if(!data) return NextResponse.json({error:"Event not found"}, {status:404});
    return NextResponse.json({success:true,event:data});
  } catch {return NextResponse.json({error:"Invalid request"}, {status:400});}
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if(!user) return NextResponse.json({error:"Unauthorized"}, {status:401});
    if(!canManageContent(user.accessRole)) return NextResponse.json({error:"Forbidden"}, {status:403});
    const body:unknown = await request.json();
    if(!body || typeof body!=="object" || !("id" in body) || typeof body.id!=="string" || !adminIdPattern.test(body.id))
      return NextResponse.json({error:"Invalid event ID"}, {status:400});
    const {data,error}=await getSupabaseAdmin().from("events").delete().eq("id",body.id).select("id").maybeSingle();
    if(error) return NextResponse.json({error:"Could not delete event"}, {status:503});
    if(!data) return NextResponse.json({error:"Event not found"}, {status:404});
    return NextResponse.json({success:true});
  } catch {return NextResponse.json({error:"Invalid request"}, {status:400});}
}
