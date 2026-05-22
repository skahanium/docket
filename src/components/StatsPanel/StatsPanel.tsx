import { type Component, Show, For, createSignal, createResource } from 'solid-js'
import styles from './StatsPanel.module.css'
import {
  statsPanel,
  taskMutationEpoch,
  setActiveView,
  setSortField,
  setSortDir,
  clearFilters,
  getCalendarMonth,
} from '../../stores'

const WEEKDAYS = ['一','二','三','四','五','六','日']

const StatsPanel: Component = () => {
  const panel = () => statsPanel()
  const stats = () => panel()?.statistics
  const accuracyData = () => panel()?.weekly_accuracy
  const heatmapData = () => panel()?.focus_heatmap
  const loading = () => statsPanel.loading
  const rate = () => stats() ? Math.round(stats()!.weekly_completion_rate * 100) : 0
  const totalCompleted = () => stats() ? stats()!.daily_counts.reduce((s, d) => s + d.completed, 0) : 0
  const maxVal = () => stats() ? Math.max(...stats()!.daily_counts.map(d => d.completed), 1) : 1

  const [miniYear, setMiniYear] = createSignal(new Date().getFullYear())
  const [miniMonth, setMiniMonth] = createSignal(new Date().getMonth() + 1)
  const [miniSelected, setMiniSelected] = createSignal<string | null>(null)

  const [miniCalData] = createResource(
    () => ({ year: miniYear(), month: miniMonth(), _: taskMutationEpoch() }),
    ({ year, month }) => getCalendarMonth(year, month),
  )

  const formatMins = (m: number) => {
    if (m >= 60) { const h = Math.floor(m / 60); const min = m % 60; return min > 0 ? `${h}h ${min}m` : `${h}h` }
    return `${m}m`
  }

  const heatmapMax = () => {
    const h = heatmapData()
    if (!h || h.length === 0) return 1
    return Math.max(...h.map(e => e.minutes), 1)
  }

  const today = new Date()
  const isToday = (ds: string) => {
    const d = new Date(ds)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  const days = () => miniCalData() ?? []
  const offset = days().length > 0 ? (new Date(days()[0].date + 'T00:00:00').getDay() + 6) % 7 : 0

  const goToToday = () => { clearFilters(); setActiveView('today') }
  const goToOverdue = () => { clearFilters(); setActiveView('all'); setSortField('due_date'); setSortDir('asc') }

  return (
    <div class={styles.container}>
      <h2 class={styles.title}>统计</h2>

      <div style={{ display: 'flex', gap: '20px', 'flex-wrap': 'wrap' }}>
        <div style={{ flex: '1', 'min-width': '0' }}>
          <Show when={!loading()} fallback={
            <div class={styles.cards}>
              {[0,1,2,3].map(() => (
                <div class={styles.skeletonCard}>
                  <div class={`${styles.skeletonLine} skeleton`} />
                  <div class={`${styles.skeletonLine} skeleton`} />
                </div>
              ))}
            </div>
          }>
            <Show when={stats()} fallback={<p style={{ 'font-size': '14px', color: 'var(--text-sub)' }}>暂无统计数据</p>}>
              <div class={styles.cards}>
                <div class={`${styles.card} ${styles.cardClickable}`} onClick={goToToday}>
                  <p class={styles.cardLabel}>今日任务</p>
                  <p class={styles.cardValue}>{stats()!.today_count}</p>
                </div>
                <div class={`${styles.card} ${styles.cardClickable}`} onClick={goToOverdue}>
                  <p class={styles.cardLabel}>逾期任务</p>
                  <p class={`${styles.cardValue} ${stats()!.overdue_count > 0 ? styles.cardValueDanger : ''}`}>{stats()!.overdue_count}</p>
                </div>
                <div class={styles.card}>
                  <p class={styles.cardLabel}>周完成率</p>
                  <p class={styles.cardValue}>{rate()}%</p>
                </div>
                <div class={styles.card}>
                  <p class={styles.cardLabel}>周完成数</p>
                  <p class={`${styles.cardValue} ${styles.cardValueAccent}`}>{totalCompleted()}</p>
                </div>
              </div>

              <div class={styles.chart}>
                <p class={styles.chartLabel}>近 7 天完成趋势</p>
                <div class={styles.bars}>
                  <For each={stats()!.daily_counts}>{(day) => {
                    const h = Math.max((day.completed / maxVal()) * 100, day.completed > 0 ? 4 : 1)
                    return (
                      <div class={styles.barCol}>
                        <span class={styles.barVal}>{day.completed}</span>
                        <div class={styles.bar} style={{ height: `${h}%`, opacity: day.completed > 0 ? 0.85 : 0.2 }} />
                        <span class={styles.barLabel}>{day.date.slice(5)}</span>
                      </div>
                    )
                  }}</For>
                </div>
              </div>

              <Show when={accuracyData() && accuracyData()!.days.some(d => (d.estimated_minutes || 0) > 0 || (d.actual_minutes || 0) > 0)}>
                <div class={styles.chart} style={{ 'margin-top': '16px' }}>
                  <p class={styles.chartLabel}>预估 vs 实际</p>
                  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                    <For each={accuracyData()!.days}>{(day) => {
                      const est = day.estimated_minutes || 0
                      const act = day.actual_minutes || 0
                      const max = Math.max(est, act, 1)
                      return (
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                          <span style={{ 'font-size': '13px', color: 'var(--text-sub)', width: '36px', 'flex-shrink': '0' }}>{day.date.slice(5)}</span>
                          <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
                              <div style={{
                                height: '6px', 'border-radius': '3px', background: 'var(--accent)', opacity: 0.3,
                                width: `${Math.round(est / max * 100)}%`, 'min-width': '2px',
                              }} />
                              <span style={{ 'font-size': '11px', color: 'var(--text-label)' }}>{formatMins(est)}</span>
                            </div>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
                              <div style={{
                                height: '6px', 'border-radius': '3px', background: 'var(--accent)',
                                width: `${Math.round(act / max * 100)}%`, 'min-width': '2px',
                              }} />
                              <span style={{ 'font-size': '11px', color: 'var(--text-sub)', 'font-weight': '500' }}>{formatMins(act)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    }}</For>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', 'margin-top': '12px', 'font-size': '12px', color: 'var(--text-label)' }}>
                    <span style={{ opacity: 0.3 }}>▬ 预估</span>
                    <span>▬ 实际</span>
                  </div>
                </div>
              </Show>

              <Show when={heatmapData() && heatmapMax() > 0}>
                <div class={styles.chart} style={{ 'margin-top': '16px' }}>
                  <p class={styles.chartLabel}>专注时段分布</p>
                  <div style={{ display: 'flex', 'align-items': 'flex-end', gap: '2px', height: '80px' }}>
                    <For each={heatmapData()}>{(entry) => {
                      const h = Math.max((entry.minutes / heatmapMax()) * 100, entry.minutes > 0 ? 4 : 1)
                      const opacity = 0.2 + (entry.minutes / heatmapMax()) * 0.8
                      return (
                        <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '2px' }}>
                          <div
                            style={{
                              width: '100%', 'border-radius': '2px 2px 0 0', background: 'var(--accent)',
                              height: `${h}%`, 'min-height': entry.minutes > 0 ? '4px' : '1px', opacity: opacity,
                            }}
                            title={`${entry.hour}:00 - ${formatMins(entry.minutes)}`}
                          />
                          <span style={{
                            'font-size': '9px',
                            color: (entry.hour === 8 || entry.hour === 14) ? 'var(--text-sub)' : 'var(--text-label)',
                          }}>
                            {entry.hour % 3 === 0 ? entry.hour : ''}
                          </span>
                        </div>
                      )
                    }}</For>
                  </div>
                </div>
              </Show>
            </Show>
          </Show>
        </div>

        <div style={{ width: '230px', 'flex-shrink': '0' }}>
          <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '8px' }}>
            <button style={{ border: 'none', background: 'none', color: 'var(--text-sub)', cursor: 'pointer', 'font-size': '14px' }} onClick={() => miniMonth() === 1 ? (setMiniYear(y => y - 1), setMiniMonth(12)) : setMiniMonth(m => m - 1)}>‹</button>
            <span style={{ 'font-size': '13px', 'font-weight': '500', color: 'var(--text-main)' }}>{miniYear()}/{String(miniMonth()).padStart(2, '0')}</span>
            <button style={{ border: 'none', background: 'none', color: 'var(--text-sub)', cursor: 'pointer', 'font-size': '14px' }} onClick={() => miniMonth() === 12 ? (setMiniYear(y => y + 1), setMiniMonth(1)) : setMiniMonth(m => m + 1)}>›</button>
          </div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(7,1fr)', gap: '1px', border: '1px solid var(--border)', 'border-radius': '4px', overflow: 'hidden' }}>
            <For each={WEEKDAYS}>{(d) => <div style={{ 'text-align': 'center', 'font-size': '10px', 'font-weight': '600', color: 'var(--text-label)', padding: '2px 0' }}>{d}</div>}</For>
            <For each={Array.from({ length: offset })}>{() => <div style={{ 'aspect-ratio': '1' }} />}</For>
            <For each={days()}>{(day) => {
              const d = parseInt(day.date.split('-')[2], 10)
              const active = miniSelected() === day.date
              const tdy = isToday(day.date)
              return (
                <div
                  onClick={() => setMiniSelected(active ? null : day.date)}
                  style={{
                    'aspect-ratio': '1', display: 'flex', 'align-items': 'center', 'justify-content': 'center',
                    cursor: 'pointer', 'font-size': '11px', 'border-radius': '2px',
                    background: tdy ? 'var(--accent)' : active ? 'rgba(0,112,243,0.1)' : '',
                    color: tdy ? '#fff' : active ? 'var(--accent)' : 'var(--text-main)',
                    'font-weight': tdy || active ? 600 : 400,
                    transition: 'background-color 100ms ease',
                  }}
                >
                  {d}
                </div>
              )
            }}</For>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatsPanel
