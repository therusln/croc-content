export interface Project {
  id: string
  name: string
  created_at: string
}

export interface Translation {
  id: string
  project_id: string
  key_path: string
  az_value: string | null
  en_value: string | null
  ru_value: string | null
  token_type: string | null
  figma_variable_id: string | null
  original_key: string | null
  created_at: string
  updated_at: string
}

export interface GroupExtension {
  id: string
  project_id: string
  group_path: string
  extensions: Record<string, unknown>
}

export interface KeyIssue {
  original: string
  suggested: string
  keyPath: string
}

export interface DuplicateGroup {
  value: string
  language: 'az' | 'en' | 'ru'
  keyPaths: string[]
}
