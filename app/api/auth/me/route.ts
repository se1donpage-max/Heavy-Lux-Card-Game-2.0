
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Current user API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
