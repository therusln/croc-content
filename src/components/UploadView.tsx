import { useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { flattenJsons } from '../utils/jsonFlattener'

interface UploadViewProps {
  projectId: string
  onUploadComplete: () => void
}

type LangKey = 'az' | 'en' | 'ru'

const LANG_LABELS: Record<LangKey, string> = {
  az: 'Azerbaijani',
  en: 'English',
  ru: 'Russian',
}

export default function UploadView({ projectId, onUploadComplete }: UploadViewProps) {
  const [files, setFiles] = useState<Record<LangKey, Record<string, unknown> | null>>({
    az: null,
    en: null,
    ru: null,
  })
  const [fileNames, setFileNames] = useState<Record<LangKey, string>>({
    az: '',
    en: '',
    ru: '',
  })
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const handleFile = useCallback((lang: LangKey, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        setFiles((prev) => ({ ...prev, [lang]: json }))
        setFileNames((prev) => ({ ...prev, [lang]: file.name }))
        setStatus(null)
      } catch {
        setStatus(`Invalid JSON in ${file.name}`)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (lang: LangKey) => (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(lang, file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (lang: LangKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(lang, file)
    },
    [handleFile],
  )

  const hasAnyFile = files.az || files.en || files.ru

  async function handleUpload() {
    setUploading(true)
    setStatus('Flattening JSON files...')

    try {
      const result = flattenJsons(files.az, files.en, files.ru)
      const rows = result.rows.filter((r) => r.key_path && r.key_path.trim() !== '')
      const groupExtensions = result.groupExtensions

      if (rows.length === 0) {
        setStatus('No translation tokens found in the uploaded files.')
        setUploading(false)
        return
      }

      setStatus(`Uploading ${rows.length} tokens...`)

      // Upsert translations
      const { error: transError } = await supabase
        .from('translations')
        .upsert(
          rows.map((r) => ({
            project_id: projectId,
            key_path: r.key_path,
            az_value: r.az_value,
            en_value: r.en_value,
            ru_value: r.ru_value,
            token_type: r.token_type,
            figma_variable_id: r.figma_variable_id,
          })),
          { onConflict: 'project_id,key_path' },
        )

      if (transError) throw transError

      // Upsert group extensions
      if (groupExtensions.length > 0) {
        const { error: geError } = await supabase
          .from('group_extensions')
          .upsert(
            groupExtensions.map((ge) => ({
              project_id: projectId,
              group_path: ge.group_path,
              extensions: ge.extensions,
            })),
            { onConflict: 'project_id,group_path' },
          )

        if (geError) throw geError
      }

      setStatus(`Successfully uploaded ${rows.length} tokens.`)
      setFiles({ az: null, en: null, ru: null })
      setFileNames({ az: '', en: '', ru: '' })
      onUploadComplete()
    } catch (err) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-gray-900">Upload</h2>
        <p className="text-gray-500 text-sm mt-1">
          Drop your Figma JSON exports here. You can upload one, two, or all three languages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(LANG_LABELS) as LangKey[]).map((lang) => (
          <div
            key={lang}
            onDrop={handleDrop(lang)}
            onDragOver={(e) => e.preventDefault()}
            className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer
              ${files[lang]
                ? 'border-success bg-success-light'
                : 'border-gray-200 hover:border-gray-400 bg-gray-50'
              }`}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput(lang)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-2">
              <div className="text-2xl">{files[lang] ? '✓' : '↑'}</div>
              <p className="font-medium text-sm text-gray-700">
                {LANG_LABELS[lang]}
              </p>
              {fileNames[lang] ? (
                <p className="text-xs text-gray-500 truncate">{fileNames[lang]}</p>
              ) : (
                <p className="text-xs text-gray-400">Drop JSON or click to browse</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {status && (
        <div className={`text-sm px-4 py-3 rounded-xl ${
          status.startsWith('Successfully')
            ? 'bg-success-light text-green-800'
            : status.startsWith('Upload failed') || status.startsWith('Invalid')
              ? 'bg-danger-light text-red-800'
              : 'bg-gray-100 text-gray-600'
        }`}>
          {status}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!hasAnyFile || uploading}
        className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl
                   hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading...' : 'Upload & Merge'}
      </button>
    </div>
  )
}
