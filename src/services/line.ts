/**
 * LINE Messaging API 通知サービス
 * 設定は「通知設定」画面から入力するか .env.local に記載
 *
 * ※ CORS の制限により、本番環境では Firebase Functions などの
 *    サーバーサイドプロキシ経由での送信を推奨します。
 */
import { loadSettings } from "./notificationSettings";

const LINE_API = "https://api.line.me/v2/bot/message/push";

export async function sendLineMessage(text: string): Promise<void> {
  const { lineToken: TOKEN, lineGroupId: TO } = loadSettings();
  if (!TOKEN || !TO) {
    console.warn("[LINE] 設定が未完了です。通知設定画面で設定してください。");
    return;
  }
  try {
    await fetch(LINE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        to: TO,
        messages: [{ type: "text", text }],
      }),
    });
  } catch (err) {
    console.error("[LINE] 送信エラー:", err);
  }
}

export function buildEventMessage(
  action: "added" | "updated" | "deleted",
  title: string,
  date: string,
  location: string
): string {
  const icons: Record<string, string> = {
    added: "🎾 新規",
    updated: "📝 変更",
    deleted: "❌ 削除",
  };
  return `【テニス部お知らせ】${icons[action]}イベント\n\n📅 ${date}\n🏷 ${title}\n📍 ${location}\n\nご確認ください。`;
}
