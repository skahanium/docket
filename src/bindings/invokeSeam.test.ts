import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setInvokeForTests, resetInvokeForTests } from './core'
import { getStatsPanel } from './stats'

describe('invoke seam', () => {
  const mock = vi.fn()

  beforeEach(() => {
    mock.mockResolvedValue({
      statistics: {
        today_count: 0,
        overdue_count: 0,
        weekly_completion_rate: 0,
        daily_counts: [],
      },
      weekly_accuracy: { days: [], overall_accuracy: 0 },
      focus_heatmap: [],
    })
    setInvokeForTests(mock)
  })

  afterEach(() => resetInvokeForTests())

  it('forwards get_stats_panel to tauri invoke', async () => {
    await getStatsPanel(7)
    expect(mock).toHaveBeenCalledWith('get_stats_panel', { heatmapDays: 7 })
  })
})
