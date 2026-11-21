
import "server-only";

import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export type AccessRole = "OWNER" | "ADMIN" | "IGL" | "MEMBER";

export interface AuthenticatedUser {
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  accessRole: AccessRole;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("k7_session")?.value;

    if (!token) {
      return null;
    }

    const session = verifySession(token);

    if (!session) {
      return null;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "telegram_id, first_name, last_name, username, photo_url, access_role"
      )
      .eq("telegram_id", session.user.telegramId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const allowedRoles: AccessRole[] = [
      "OWNER",
      "ADMIN",
      "IGL",
      "MEMBER"
    ];

    if (!allowedRoles.includes(data.access_role as AccessRole)) {
      return null;
    }

    return {
      telegramId: Number(data.telegram_id),
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      photoUrl: data.photo_url,
      accessRole: data.access_role as AccessRole
    };
  } catch (error) {
    console.error("Authentication lookup failed:", error);
    return null;
  }
}
