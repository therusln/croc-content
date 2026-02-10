interface FlatRow {
  key_path: string
  az_value?: string | null
  en_value?: string | null
  ru_value?: string | null
  token_type: string | null
  figma_variable_id: string | null
}

interface GroupExt {
  group_path: string
  extensions: Record<string, unknown>
}

interface FlattenResult {
  rows: FlatRow[]
  groupExtensions: GroupExt[]
}

function flattenNode(
  node: Record<string, unknown>,
  pathPrefix: string,
  lang: 'az' | 'en' | 'ru',
  rows: Map<string, FlatRow>,
  groupExtensions: Map<string, GroupExt>,
) {
  for (const [key, value] of Object.entries(node)) {
    if (key === '$extensions') continue

    const child = value as Record<string, unknown>
    if (!child || typeof child !== 'object') continue

    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key

    if ('$value' in child) {
      // Leaf node — a translation token
      const existing = rows.get(currentPath) || {
        key_path: currentPath,
        az_value: null,
        en_value: null,
        ru_value: null,
        token_type: null,
        figma_variable_id: null,
      }

      existing[`${lang}_value`] = child.$value as string
      existing.token_type = child.$type as string || existing.token_type

      if (child.$extensions) {
        const ext = child.$extensions as Record<string, Record<string, string>>
        existing.figma_variable_id = ext?.['com.figma']?.variableId || existing.figma_variable_id
      }

      rows.set(currentPath, existing)
    } else {
      // Group node — recurse
      if (child.$extensions) {
        groupExtensions.set(currentPath, {
          group_path: currentPath,
          extensions: child.$extensions as Record<string, unknown>,
        })
      }

      flattenNode(child, currentPath, lang, rows, groupExtensions)
    }
  }
}

export function flattenJsons(
  azJson: Record<string, unknown> | null,
  enJson: Record<string, unknown> | null,
  ruJson: Record<string, unknown> | null,
): FlattenResult {
  const rows = new Map<string, FlatRow>()
  const groupExtensions = new Map<string, GroupExt>()

  if (azJson) flattenNode(azJson, '', 'az', rows, groupExtensions)
  if (enJson) flattenNode(enJson, '', 'en', rows, groupExtensions)
  if (ruJson) flattenNode(ruJson, '', 'ru', rows, groupExtensions)

  return {
    rows: Array.from(rows.values()),
    groupExtensions: Array.from(groupExtensions.values()),
  }
}
