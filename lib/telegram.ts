
import "server-only";

import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface VerifiedTelegramData {
  user: TelegramUser;
  authDate: number;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): VerifiedTelegramData | null {
  try {
    if (!initData || !botToken) {
      return null;
    }

    const params = new URLSearchParams(initData);
    const receivedHash = params.get("hash");

    if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
      return null;
    }

    const entries = Array.from(params.entries())
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => a.localeCompare(b));

    const dataCheckString = entries
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest();

    const suppliedHash = Buffer.from(receivedHash, "hex");

    if (
      suppliedHash.length !== calculatedHash.length ||
      !timingSafeEqual(suppliedHash, calculatedHash)
    ) {
      return null;
    }

    const authDateValue = params.get("auth_date");

    if (!authDateValue || !/^\d+$/.test(authDateValue)) {
      return null;
    }

    const authDate = Number(authDateValue);
    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(authDate) ||
      authDate > now + 30 ||
      now - authDate > maxAgeSeconds
    ) {
      return null;
    }

    const userValue = params.get("user");

    if (!userValue) {
      return null;
    }

    const user: unknown = JSON.parse(userValue);

    if (
      typeof user !== "object" ||
      user === null ||
      !("id" in user) ||
      !("first_name" in user) ||
      typeof user.id !== "number" ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0 ||
      typeof user.first_name !== "string"
    ) {
      return null;
    }

    return {
      user: user as TelegramUser,
      authDate
    };
  } catch {
    return null;
  }
}
