const STORAGE_KEY = 'diary_upload_max_size_mb'

export const UPLOAD_SIZE_OPTIONS = [
  { label: '1 MB', value: 1 },
  { label: '2 MB', value: 2 },
  { label: '5 MB', value: 5 },
  { label: '10 MB', value: 10 },
  { label: '20 MB', value: 20 },
  { label: '不限', value: 0 },
] as const

export function getMaxUploadSizeMB(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return 5
    const val = Number(raw)
    return val > 0 ? val : 0
  } catch {
    return 5
  }
}

export function getMaxUploadSizeBytes(): number {
  const mb = getMaxUploadSizeMB()
  return mb > 0 ? mb * 1024 * 1024 : Infinity
}

export function setMaxUploadSizeMB(mb: number): void {
  localStorage.setItem(STORAGE_KEY, String(mb))
}
