import { invoke } from './core'
import type { DailyReview, WorkloadSummary } from './types'

export function getWorkloadSummary(date?: string): Promise<WorkloadSummary> {
  return invoke<WorkloadSummary>('get_workload_summary', { date })
}

export function getDailyReview(date?: string): Promise<DailyReview> {
  return invoke<DailyReview>('get_daily_review', { date })
}
