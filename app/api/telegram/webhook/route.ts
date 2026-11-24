
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !secret) {
    return new NextResponse("Not configured", { status: 503 });
  }

  if (
    req.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const update = await req.json();
  const message = update.message;

  if (
    message?.chat?.type !== "private" ||
    !/^\/start(?:@\w+)?(?:\s|$)/.test(message?.text ?? "")
  ) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = "https://k7creww.onrender.com";

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendAnimation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chat.id,

        animation:
          `${appUrl}/K7_DARK_ELITE_BANNER_4K.mp4`,

        caption:
          "<b>K7 CREW | CONNECTED COMMUNITY</b>\n\n" +
          "Официальная платформа киберспортивной организации K7 CREW.\n\n" +
          "Будь частью команды. Следи за событиями, общайся, изучай статистику и оставайся в центре игровой жизни.\n\n" +
          "<b>ONE CREW. ONE VISION.</b>",

        parse_mode: "HTML",

        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "ОТКРЫТЬ K7 CREW",
                web_app: { url: appUrl }
              }
            ]
          ]
        }
      })
    }
  );

  return NextResponse.json(
    { ok: response.ok },
    { status: response.ok ? 200 : 502 }
  );
}
