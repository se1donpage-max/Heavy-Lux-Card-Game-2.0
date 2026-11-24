// Shared validation. Only these six user-controlled fields may be written.
export type ProfileInput = { gameId: string; gameNickname: string; displayName: string; ageYears: number | null; showName: boolean; showAge: boolean };
export function parseCommunityProfile(raw: unknown): ProfileInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.gameId !== "string" || typeof v.gameNickname !== "string" || typeof v.displayName !== "string" || typeof v.showName !== "boolean" || typeof v.showAge !== "boolean") return null;
  const gameId = v.gameId.trim(), gameNickname = v.gameNickname.trim(), displayName = v.displayName.trim();
  if (!/^\d{0,32}$/.test(gameId) || gameNickname.length > 40 || displayName.length > 60 || /[\x00-\x1f\x7f]/.test(gameNickname + displayName)) return null;
  if (v.ageYears !== null && (typeof v.ageYears !== "number" || !Number.isInteger(v.ageYears) || v.ageYears < 1 || v.ageYears > 120)) return null;
  return { gameId, gameNickname, displayName, ageYears: v.ageYears as number | null, showName: v.showName, showAge: v.showAge };
}
export function communityPosition(role: string, slot?: string | null, captain?: boolean) {
  if (role === "OWNER") return "Владелец";
  if (captain) return "Капитан";
  if (role === "ADMIN") return "Администратор";
  if (slot?.startsWith("MAIN_")) return "Игрок основного состава";
  if (slot?.startsWith("SUB_")) return "Запасной игрок";
  return "Участник проекта";
}
export function membershipDays(createdAt: string | null, now = Date.now()): number | null {
  if (!createdAt) return null;
  const start = Date.parse(createdAt);
  return Number.isFinite(start) && start <= now ? Math.floor((now-start)/86400000) : null;
}
