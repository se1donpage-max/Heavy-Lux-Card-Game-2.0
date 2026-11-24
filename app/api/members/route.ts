import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { canManageRoster } from "@/lib/permissions";
import { readAllRows } from "@/lib/pagination";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized"
        },
        { status: 401 }
      );
    }

    if (!canManageRoster(user.accessRole)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden"
        },
        { status: 403 }
      );
    }

    const db = getSupabaseAdmin();
    const data = await readAllRows((from, to) => db.from("profiles")
      .select("telegram_id, first_name, last_name, username")
      .order("created_at", { ascending: false }).order("telegram_id").range(from, to));

    return NextResponse.json(
      {
        success: true,
        members: data ?? []
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Members API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error"
      },
      { status: 500 }
    );
  }
}
