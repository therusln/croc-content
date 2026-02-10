import type { Translation, GroupExtension } from '../types'

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: Record<string, unknown>,
) {
  const segments = path.split('.')
  let current = obj

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (!(seg in current) || typeof current[seg] !== 'object') {
      current[seg] = {}
    }
    current = current[seg] as Record<string, unknown>
  }

  current[segments[segments.length - 1]] = value
}

function applyGroupExtensions(
  obj: Record<string, unknown>,
  groupExtensions: GroupExtension[],
) {
  for (const ge of groupExtensions) {
    const segments = ge.group_path.split('.')
    let current = obj

    for (const seg of segments) {
      if (!(seg in current) || typeof current[seg] !== 'object') {
        current[seg] = {}
      }
      current = current[seg] as Record<string, unknown>
    }

    current.$extensions = ge.extensions
  }
}

export function buildDeveloperJson(translations: Translation[]): Record<string, unknown> {
  const result: Record<string, unknown> = {
    'Translations/AZ': {},
    'Translations/EN': {},
    'Translations/RU': {},
  }

  for (const t of translations) {
    const tokenType = t.token_type === 'string' ? 'text' : t.token_type

    if (t.az_value != null) {
      setNestedValue(result['Translations/AZ'] as Record<string, unknown>, t.key_path, {
        $value: t.az_value,
        $type: tokenType,
      })
    }
    if (t.en_value != null) {
      setNestedValue(result['Translations/EN'] as Record<string, unknown>, t.key_path, {
        $value: t.en_value,
        $type: tokenType,
      })
    }
    if (t.ru_value != null) {
      setNestedValue(result['Translations/RU'] as Record<string, unknown>, t.key_path, {
        $value: t.ru_value,
        $type: tokenType,
      })
    }
  }

  return result
}

export function buildFigmaJson(
  translations: Translation[],
  groupExtensions: GroupExtension[],
  lang: 'az' | 'en' | 'ru',
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const valueKey = `${lang}_value` as const

  for (const t of translations) {
    const val = t[valueKey]
    if (val == null) continue

    const token: Record<string, unknown> = {
      $type: t.token_type,
      $value: val,
    }

    if (t.figma_variable_id) {
      token.$extensions = {
        'com.figma': { variableId: t.figma_variable_id },
      }
    }

    setNestedValue(result, t.key_path, token)
  }

  applyGroupExtensions(result, groupExtensions)

  return result
}
