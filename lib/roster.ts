
import "server-only";

import type { AccessRole } from "@/lib/auth";

export type GameRole =
  | "FLEX"
  | "IGL"
  | "SUPPORT"
  | "FRAGGER"
  | "SNIPER";

export type RosterSlot =
  | "MAIN_1"
  | "MAIN_2"
  | "MAIN_3"
  | "MAIN_4"
  | "SUB_1"
  | "SUB_2"
  | "SUB_3";

export interface RosterInput {
  telegramId: number;
  slot: RosterSlot;
  gameRole: GameRole;
  inGameId?: string | null;
  isCaptain?: boolean;
}

export const ROSTER_SLOTS: RosterSlot[] = [
  "MAIN_1",
  "MAIN_2",
  "MAIN_3",
  "MAIN_4",
  "SUB_1",
  "SUB_2",
  "SUB_3"
];

export const GAME_ROLES: GameRole[] = [
  "FLEX",
  "IGL",
  "SUPPORT",
  "FRAGGER",
  "SNIPER"
];

export function validateRosterInput(
  input: RosterInput
): string | null {
  if (
    !Number.isSafeInteger(input.telegramId) ||
    input.telegramId <= 0
  ) {
    return "Invalid Telegram ID";
  }

  if (!ROSTER_SLOTS.includes(input.slot)) {
    return "Invalid roster slot";
  }

  if (!GAME_ROLES.includes(input.gameRole)) {
    return "Invalid game role";
  }

  if (
    input.inGameId !== undefined &&
    input.inGameId !== null &&
    (
      typeof input.inGameId !== "string" ||
      input.inGameId.length > 40
    )
  ) {
    return "Invalid in-game ID";
  }

  if (
    input.isCaptain !== undefined &&
    typeof input.isCaptain !== "boolean"
  ) {
    return "Invalid captain status";
  }

  return null;
}

export function canEditRoster(role: AccessRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
