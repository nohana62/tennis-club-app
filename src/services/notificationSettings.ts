const STORAGE_KEY = 'tennis_club_notification_settings';

export interface NotificationSettings {
  teamsWebhookUrl: string;
  lineToken: string;
  lineGroupId: string;
}

const DEFAULTS: NotificationSettings = {
  teamsWebhookUrl: import.meta.env.VITE_TEAMS_WEBHOOK_URL ?? '',
  lineToken: import.meta.env.VITE_LINE_CHANNEL_ACCESS_TOKEN ?? '',
  lineGroupId: import.meta.env.VITE_LINE_GROUP_ID ?? '',
};

export function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(settings: NotificationSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
