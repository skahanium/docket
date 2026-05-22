import { invoke } from './core'

export interface NotificationSettings {
  notify_daily_summary: boolean
  notify_daily_time: string
  notify_overdue: boolean
  notify_overdue_interval_minutes: string
}

export function getNotificationSettings(): Promise<NotificationSettings> {
  return invoke<NotificationSettings>('get_notification_settings')
}

export function updateNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  return invoke<void>('update_notification_settings', { settings })
}
