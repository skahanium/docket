export type EvidenceKind = 'file' | 'folder'

export function evidenceLinkInput(
  path: string,
  kind: EvidenceKind,
): { path: string; kind: EvidenceKind } | null {
  const trimmed = path.trim()
  if (!trimmed) return null
  return { path: trimmed, kind }
}
