/** Build the `update_task` patch for saving a description (empty means clear). */
export function descriptionSavePatch(
  text: string,
): { description: string } | { clear_description: true } {
  const trimmed = text.trim()
  return trimmed ? { description: trimmed } : { clear_description: true }
}
