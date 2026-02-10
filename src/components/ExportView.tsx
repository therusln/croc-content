import { useState } from 'react'
import type { Translation, GroupExtension } from '../types'
import { supabase } from '../supabaseClient'
import { buildDeveloperJson, buildFigmaJson } from '../utils/jsonBuilder'

interface ExportViewProps {
  projectId: string
  translations: Translation[]
}

function downloadJson(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportView({ projectId, translations }: ExportViewProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [exporting, setExporting] = useState(false)

  async function fetchGroupExtensions(): Promise<GroupExtension[]> {
    const { data } = await supabase.from('group_extensions').select('*').eq('project_id', projectId)
    return (data as GroupExtension[]) || []
  }

  async function handleDeveloperExport() {
    setExporting(true)
    const json = buildDeveloperJson(translations)
    downloadJson(json, 'translations.json')
    setPreview(JSON.stringify(json, null, 2))
    setPreviewTitle('Developer Export')
    setExporting(false)
  }

  async function handleFigmaExport(lang: 'az' | 'en' | 'ru') {
    setExporting(true)
    const groupExtensions = await fetchGroupExtensions()
    const json = buildFigmaJson(translations, groupExtensions, lang)
    downloadJson(json, `translations-${lang}.json`)
    setPreview(JSON.stringify(json, null, 2))
    setPreviewTitle(`Figma Export — ${lang.toUpperCase()}`)
    setExporting(false)
  }

  const hasData = translations.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-gray-900">Export</h2>
        <p className="text-gray-500 text-sm mt-1">
          Download translations as JSON files for developers or Figma.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Developer export */}
        <div className="rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-display font-bold text-gray-900">For Developers</h3>
          <p className="text-sm text-gray-500">
            Combined JSON with all languages under <code className="bg-gray-100 px-1 rounded text-xs">Translations/</code>.
            Token type <code className="bg-gray-100 px-1 rounded text-xs">string</code> is converted to <code className="bg-gray-100 px-1 rounded text-xs">text</code>.
          </p>
          <button
            onClick={handleDeveloperExport}
            disabled={!hasData || exporting}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl
                       hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Download translations.json
          </button>
        </div>

        {/* Figma export */}
        <div className="rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-display font-bold text-gray-900">For Figma</h3>
          <p className="text-sm text-gray-500">
            Separate per-language JSONs with <code className="bg-gray-100 px-1 rounded text-xs">$extensions</code> and variable IDs preserved.
          </p>
          <div className="flex gap-2">
            {(['az', 'en', 'ru'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => handleFigmaExport(lang)}
                disabled={!hasData || exporting}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl
                           hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">{previewTitle}</h3>
            <button
              onClick={() => setPreview(null)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Close preview
            </button>
          </div>
          <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700
                          overflow-auto max-h-[400px] font-mono">
            {preview}
          </pre>
        </div>
      )}

      {!hasData && (
        <p className="text-sm text-gray-400 text-center py-8">
          No translations to export. Upload JSON files first.
        </p>
      )}
    </div>
  )
}
