import { invoke } from './core'
import type { AddStepLinkInput, MatterStepLink } from './types'

export function addStepLink(matterStepId: number, input: AddStepLinkInput): Promise<number> {
  return invoke<number>('add_step_link', { matterStepId, input })
}

export function removeStepLink(linkId: number): Promise<void> {
  return invoke<void>('remove_step_link', { linkId })
}

export function replaceStepLink(linkId: number, path: string): Promise<number> {
  return invoke<number>('replace_step_link', { linkId, path })
}

export function openStepLink(linkId: number): Promise<void> {
  return invoke<void>('open_step_link', { linkId })
}

export function revealStepLink(linkId: number): Promise<void> {
  return invoke<void>('reveal_step_link', { linkId })
}

export function pickEvidencePath(directory: boolean): Promise<string | null> {
  return invoke<string | null>('pick_evidence_path', { directory })
}

export function getStepLink(linkId: number): Promise<MatterStepLink> {
  return invoke<MatterStepLink>('get_step_link', { linkId })
}
