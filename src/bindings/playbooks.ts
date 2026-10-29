import { invoke } from './core'
import type { CreatePlaybookInput, Playbook, PlaybookStepInput, UpdatePlaybookInput } from './types'

export function listPlaybooks(includeArchived = false): Promise<Playbook[]> {
  return invoke<Playbook[]>('list_playbooks', { includeArchived })
}

export function createPlaybook(input: CreatePlaybookInput): Promise<number> {
  return invoke<number>('create_playbook', { input })
}

export function updatePlaybook(id: number, input: UpdatePlaybookInput): Promise<void> {
  return invoke<void>('update_playbook', { id, input })
}

export function setPlaybookSteps(playbookId: number, steps: PlaybookStepInput[]): Promise<void> {
  return invoke<void>('set_playbook_steps', { playbookId, steps })
}

export function getPlaybook(id: number): Promise<Playbook> {
  return invoke<Playbook>('get_playbook', { id })
}
