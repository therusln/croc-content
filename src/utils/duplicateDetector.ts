import type { Translation, DuplicateGroup } from '../types'

export function findDuplicateValues(translations: Translation[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = []
  const languages = ['az', 'en', 'ru'] as const

  for (const lang of languages) {
    const valueKey = `${lang}_value` as const
    const valueMap = new Map<string, string[]>()

    for (const t of translations) {
      const val = t[valueKey]
      if (!val || val.trim() === '') continue

      const existing = valueMap.get(val) || []
      existing.push(t.key_path)
      valueMap.set(val, existing)
    }

    for (const [value, keyPaths] of valueMap) {
      if (keyPaths.length > 1) {
        duplicates.push({ value, language: lang, keyPaths })
      }
    }
  }

  return duplicates
}
