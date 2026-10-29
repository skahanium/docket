export function matterMatchesCadence(
  matter: { playbook_id: number | null; tag_ids: number[] },
  filter: { playbook_ids: number[]; tag_ids: number[] },
): boolean {
  const playbookOk =
    filter.playbook_ids.length === 0 ||
    (matter.playbook_id != null && filter.playbook_ids.includes(matter.playbook_id))
  const tagsOk = filter.tag_ids.every((id) => matter.tag_ids.includes(id))
  return playbookOk && tagsOk
}
