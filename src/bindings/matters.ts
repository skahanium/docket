import { invoke } from './core'
import type {
  AddMatterStepInput,
  CreateBlankMatterInput,
  CreateMatterInput,
  MatterDetail,
  MatterSummary,
  UpdateMatterInput,
} from './types'

export function listMatters(status?: string | null): Promise<MatterSummary[]> {
  return invoke<MatterSummary[]>('list_matters', { status: status ?? null })
}

export function createMatter(input: CreateMatterInput): Promise<number> {
  return invoke<number>('create_matter', { input })
}

export function createBlankMatter(input: CreateBlankMatterInput): Promise<number> {
  return invoke<number>('create_blank_matter', { input })
}

export function getMatter(id: number): Promise<MatterDetail> {
  return invoke<MatterDetail>('get_matter', { id })
}

export function updateMatter(id: number, input: UpdateMatterInput): Promise<void> {
  return invoke<void>('update_matter', { id, input })
}

export function completeMatterStep(stepId: number): Promise<void> {
  return invoke<void>('complete_matter_step', { stepId })
}

export function skipMatterStep(stepId: number): Promise<void> {
  return invoke<void>('skip_matter_step', { stepId })
}

export function reopenMatterStep(stepId: number): Promise<void> {
  return invoke<void>('reopen_matter_step', { stepId })
}

export function addMatterStep(matterId: number, input: AddMatterStepInput): Promise<number> {
  return invoke<number>('add_matter_step', { matterId, input })
}

export function addTagToMatter(matterId: number, tagId: number): Promise<void> {
  return invoke<void>('add_tag_to_matter', { matterId, tagId })
}

export function removeTagFromMatter(matterId: number, tagId: number): Promise<void> {
  return invoke<void>('remove_tag_from_matter', { matterId, tagId })
}
