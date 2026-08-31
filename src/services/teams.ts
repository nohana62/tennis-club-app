/**
 * Microsoft Teams Incoming Webhook 通知サービス
 * 設定は「通知設定」画面から入力するか .env.local に記載
 */
import { loadSettings } from "./notificationSettings";

export async function sendTeamsMessage(
  title: string,
  text: string,
  color = "00a550"
): Promise<void> {
  const { teamsWebhookUrl: WEBHOOK_URL } = loadSettings();
  if (!WEBHOOK_URL) {
    console.warn("[Teams] 設定が未完了です。通知設定画面で設定してください。");
    return;
  }
  const body = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: title,
    sections: [
      {
        activityTitle: `🎾 テニス部 - ${title}`,
        activityText: text,
        markdown: true,
      },
    ],
  };
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[Teams] 送信エラー:", err);
  }
}

export function buildEventCard(
  action: "added" | "updated" | "deleted",
  title: string,
  date: string,
  location: string
): { title: string; text: string; color: string } {
  const configs = {
    added:   { label: "新規イベント登録", color: "00a550" },
    updated: { label: "イベント変更",     color: "f59e0b" },
    deleted: { label: "イベント削除",     color: "ef4444" },
  };
  const { label, color } = configs[action];
  return {
    title: label,
    text: `**${title}**\n\n📅 日付: ${date}\n📍 場所: ${location}`,
    color,
  };
}
