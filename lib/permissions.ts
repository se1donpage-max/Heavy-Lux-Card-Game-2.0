
import "server-only";

import type { AccessRole } from "@/lib/auth";

export type Permission =
  | "MANAGE_ACCESS"
  | "MANAGE_ROSTER"
  | "MANAGE_CONTENT"
  | "SUBMIT_MATCH_RESULTS";

const permissions: Record<AccessRole, Permission[]> = {
  OWNER: [
    "MANAGE_ACCESS",
    "MANAGE_ROSTER",
    "MANAGE_CONTENT",
    "SUBMIT_MATCH_RESULTS"
  ],

  // ADMIN is a legacy account role; only OWNER and IGL can manage content.
  ADMIN: [],

  IGL: [
    "MANAGE_ROSTER",
    "MANAGE_CONTENT",
    "SUBMIT_MATCH_RESULTS"
  ],

  MEMBER: []
};

export function hasPermission(
  role: AccessRole,
  permission: Permission
): boolean {
  return permissions[role].includes(permission);
}

export function canManageAccess(role: AccessRole): boolean {
  return hasPermission(role, "MANAGE_ACCESS");
}

export function canManageRoster(role: AccessRole): boolean {
  return hasPermission(role, "MANAGE_ROSTER");
}

export function canManageContent(role: AccessRole): boolean {
  return hasPermission(role, "MANAGE_CONTENT");
}

export function canSubmitMatchResults(role: AccessRole): boolean {
  return hasPermission(role, "SUBMIT_MATCH_RESULTS");
}
