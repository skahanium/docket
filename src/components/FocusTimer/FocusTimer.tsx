import { type Component, createSignal, onMount, onCleanup } from 'solid-js'
import styles from './FocusTimer.module.css'
import { getCurrentFocus, stopFocus, abandonFocus } from '../../stores'
import type { FocusSession } from '../../bindings/types'
import { getCurrentWindow } from '@tauri-apps/api/window'

function fmtMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const FocusTimer: Component = () => {
  const [session, setSession] = createSignal<FocusSession | null>(null)
  const [elapsed, setElapsed] = createSignal(0)
  const [paused, setPaused] = createSignal(false)
  const [stopping, setStopping] = createSignal(false)

  let timerInterval: ReturnType<typeof setInterval> | null = null

  const load = async () => {
    try {
      const s = await getCurrentFocus()
      setSession(s)
      if (s) {
        const started = new Date(s.started_at).getTime()
        setElapsed(Math.floor((Date.now() - started) / 1000))
      }
    } catch {
      setSession(null)
    }
  }

  onMount(() => {
    load()
    timerInterval = setInterval(() => {
      if (!paused() && session()) {
        setElapsed(e => e + 1)
      }
    }, 1000)
  })

  onCleanup(() => {
    if (timerInterval) clearInterval(timerInterval)
  })

  const handlePause = () => setPaused(true)
  const handleResume = () => setPaused(false)

  const handleComplete = async () => {
    if (!session() || stopping()) return
    setStopping(true)
    try {
      await stopFocus(session()!.id, true)
      setSession(null)
      const win = getCurrentWindow()
      await win.hide()
    } catch (e) {
      console.error('Failed to stop focus:', e)
    } finally {
      setStopping(false)
    }
  }

  const handleAbandon = async () => {
    if (!session()) return
    try {
      await abandonFocus(session()!.id)
      setSession(null)
      const win = getCurrentWindow()
      await win.hide()
    } catch { }
  }

  const displayTime = () => fmtMinSec(elapsed())

  return (
    <div class={styles.window}>
      {session() ? (
        <>
          <p class={styles.statusLabel + (paused() ? ' ' + styles.statusPaused : '')}>
            {paused() ? '已暂停' : session()!.task_title ? `正在专注: ${session()!.task_title}` : '专注中'}
          </p>

          <p class={styles.timer}>
            {displayTime()}
            <span class={styles.elapsed}>
              &nbsp;
            </span>
          </p>

          <div class={styles.actions}>
            {paused() ? (
              <button class={`${styles.btn} ${styles.resumeBtn}`} onClick={handleResume}>
                继续
              </button>
            ) : (
              <button class={`${styles.btn} ${styles.pauseBtn}`} onClick={handlePause}>
                暂停
              </button>
            )}

            <button class={`${styles.btn} ${styles.completeBtn}`} onClick={handleComplete} disabled={stopping()}>
              {stopping() ? '处理中…' : '完成'}
            </button>

            <button class={`${styles.btn} ${styles.abandonBtn}`} onClick={handleAbandon}>
              放弃
            </button>
          </div>

          <p class={styles.closeHint}>当前专注时长不会丢失，可随时返回</p>
        </>
      ) : (
        <>
          <p class={styles.taskName}>无进行中的专注会话</p>
          <p class={styles.closeHint}>请从任务详情中启动专注</p>
        </>
      )}
    </div>
  )
}

export default FocusTimer