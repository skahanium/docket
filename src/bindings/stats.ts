import { invoke } from './core'
import type { StatsPanelData } from './types'

export function getStatsPanel(heatmapDays?: number): Promise<StatsPanelData> {
  return invoke<StatsPanelData>('get_stats_panel', { heatmapDays })
}
