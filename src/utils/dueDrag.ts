export type DueDragPayload = { kind: 'task' | 'matter_step'; id: number; due?: string | null }

export function encodeDueDrag(payload: DueDragPayload): string {
  return JSON.stringify(payload)
}

export function parseDueDrag(raw: string | undefined): DueDragPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DueDragPayload> | number
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
      return { kind: 'task', id: parsed }
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.kind === 'task' || parsed.kind === 'matter_step') &&
      typeof parsed.id === 'number' &&
      Number.isFinite(parsed.id) &&
      parsed.id > 0
    ) {
      const out: DueDragPayload = { kind: parsed.kind, id: parsed.id }
      if (typeof parsed.due === 'string' || parsed.due === null) out.due = parsed.due
      return out
    }
  } catch {
    const id = parseInt(raw, 10)
    if (id > 0) return { kind: 'task', id }
  }
  return null
}
