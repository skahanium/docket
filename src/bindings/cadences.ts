import { invoke } from './core'
import type { Cadence, CadenceProgress, CreateCadenceInput, UpdateCadenceInput } from './types'

export function listCadences(): Promise<Cadence[]> {
  return invoke<Cadence[]>('list_cadences')
}

export function createCadence(input: CreateCadenceInput): Promise<number> {
  return invoke<number>('create_cadence', { input })
}

export function updateCadence(id: number, input: UpdateCadenceInput): Promise<void> {
  return invoke<void>('update_cadence', { id, input })
}

export function getCadenceProgress(id: number, asOf?: string | null): Promise<CadenceProgress> {
  return invoke<CadenceProgress>('get_cadence_progress', { id, asOf: asOf ?? null })
}
