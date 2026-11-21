
import "server-only";

import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

export interface SessionUser {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

interface SessionPayload {
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
}

const SESSION_DURATION = 7 * 24 * 60 * 60;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }

  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

export function createSession(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    user,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function verifySession(
  token: string
): SessionPayload | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encoded, receivedSignature] = parts;

    const expectedSignature = sign(encoded);

    const received = Buffer.from(receivedSignature);
    const expected = Buffer.from(expectedSignature);

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return null;
    }

    const payload: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("user" in payload) ||
      !("issuedAt" in payload) ||
      !("expiresAt" in payload)
    ) {
      return null;
    }

    const session = payload as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(session.issuedAt) ||
      !Number.isSafeInteger(session.expiresAt) ||
      session.issuedAt > now + 30 ||
      session.expiresAt <= now ||
      session.expiresAt - session.issuedAt !== SESSION_DURATION
    ) {
      return null;
    }

    if (
      !session.user ||
      !Number.isSafeInteger(session.user.telegramId) ||
      session.user.telegramId <= 0 ||
      typeof session.user.firstName !== "string"
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
