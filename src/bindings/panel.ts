import { invoke } from './core'
import type { DesktopPanelSnapshot, PanelSettings } from './generated'

export type { DesktopPanelSnapshot, PanelSettings, TaskPanelRow } from './generated'

export function getDesktopPanelSnapshot(): Promise<DesktopPanelSnapshot> {
  return invoke<DesktopPanelSnapshot>('get_desktop_panel_snapshot')
}

export function getPanelSettings(): Promise<PanelSettings> {
  return invoke<PanelSettings>('get_panel_settings')
}

export function updatePanelSettings(settings: PanelSettings): Promise<void> {
  return invoke<void>('update_panel_settings', { settings })
}

export function focusTaskFromPanel(taskId: number): Promise<void> {
  return invoke<void>('focus_task_from_panel', { taskId })
}

/** 显示/隐藏桌面任务面板，返回切换后是否可见。 */
export function toggleDesktopPanel(): Promise<boolean> {
  return invoke<boolean>('toggle_desktop_panel')
}

export function isDesktopPanelVisible(): Promise<boolean> {
  return invoke<boolean>('is_desktop_panel_visible')
}
