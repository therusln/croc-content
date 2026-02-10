import { useState, useRef, useEffect } from 'react'
import type { Translation, KeyIssue, DuplicateGroup } from '../types'
import { supabase } from '../supabaseClient'

interface TableRowProps {
  translation: Translation
  issue: KeyIssue | null
  isDuplicate: boolean
  duplicateGroups: DuplicateGroup[] | null
  onUpdate: (updated: Translation) => void
  onContextMenu: (e: React.MouseEvent) => void
  indented?: boolean
}

type EditableField = 'key_path' | 'az_value' | 'en_value' | 'ru_value'

export default function TableRow({ translation, issue, isDuplicate, duplicateGroups, onUpdate, onContextMenu, indented }: TableRowProps) {
  const [editing, setEditing] = useState<EditableField | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [showIssueFix, setShowIssueFix] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      if (editing === 'key_path') inputRef.current?.focus()
      else textareaRef.current?.focus()
    }
  }, [editing])

  function startEdit(field: EditableField) {
    setEditing(field)
    setEditValue(translation[field] || '')
  }

  async function saveEdit() {
    if (!editing) return
    const currentValue = translation[editing] || ''
    if (editValue === currentValue) {
      setEditing(null)
      return
    }

    setSaving(true)

    if (editing === 'key_path') {
      const { error } = await supabase
        .from('translations')
        .update({
          key_path: editValue,
          original_key: translation.original_key || translation.key_path,
        })
        .eq('id', translation.id)

      if (!error) {
        onUpdate({
          ...translation,
          key_path: editValue,
          original_key: translation.original_key || translation.key_path,
        })
      }
    } else {
      const { error } = await supabase
        .from('translations')
        .update({ [editing]: editValue || null })
        .eq('id', translation.id)

      if (!error) {
        onUpdate({ ...translation, [editing]: editValue || null })
      }
    }

    setSaving(false)
    setEditing(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditing(null)
  }

  async function acceptIssueFix() {
    if (!issue) return
    setSaving(true)

    const newKeyPath = issue.keyPath
    const { error } = await supabase
      .from('translations')
      .update({
        key_path: newKeyPath,
        original_key: translation.original_key || translation.key_path,
      })
      .eq('id', translation.id)

    if (!error) {
      onUpdate({
        ...translation,
        key_path: newKeyPath,
        original_key: translation.original_key || translation.key_path,
      })
    }
    setSaving(false)
    setShowIssueFix(false)
  }

  function renderCell(field: 'az_value' | 'en_value' | 'ru_value') {
    const value = translation[field]

    if (editing === field) {
      return (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(null)
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              saveEdit()
            }
          }}
          disabled={saving}
          rows={Math.max(2, editValue.split('\n').length)}
          className="w-full px-2 py-1 text-sm border border-accent rounded-lg bg-white resize-y
                     focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )
    }

    return (
      <div
        onClick={() => startEdit(field)}
        className="px-2 py-1 text-sm cursor-pointer rounded-lg hover:bg-gray-100 min-h-[28px]
                   break-words transition-colors"
      >
        {value || <span className="text-gray-300 italic">empty</span>}
      </div>
    )
  }

  const keySegments = translation.key_path.split('.')
  const lastSegment = keySegments[keySegments.length - 1]
  const prefix = keySegments.length > 1 ? keySegments.slice(0, -1).join('.') + '.' : ''

  return (
    <>
      <tr
        onContextMenu={onContextMenu}
        className={`border-b border-gray-100 ${isDuplicate ? 'bg-danger-light' : ''} ${issue ? 'bg-warning-light' : ''}`}
      >
        <td className={`py-2.5 text-sm ${indented ? 'pl-10 pr-4' : 'px-4'}`} style={{ maxWidth: 600 }}>
          {editing === 'key_path' ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className="w-full px-2 py-1 text-sm border border-accent rounded-lg bg-white
                         focus:outline-none focus:ring-1 focus:ring-accent"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              {issue && (
                <button
                  onClick={() => setShowIssueFix(!showIssueFix)}
                  className="shrink-0 w-5 h-5 rounded-full bg-warning text-white text-xs flex items-center justify-center"
                  title="Key issue detected"
                >
                  !
                </button>
              )}
              {isDuplicate && duplicateGroups && (
                <span
                  className="shrink-0 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center"
                  title={duplicateGroups.map((g) => {
                    const langLabel = { az: 'AZ', en: 'EN', ru: 'RU' }[g.language]
                    const others = g.keyPaths.filter((kp) => kp !== translation.key_path)
                    const preview = g.value.length > 50 ? g.value.slice(0, 50) + '…' : g.value
                    return `${langLabel} "${preview}" — also in: ${others.join(', ')}`
                  }).join('\n')}
                >
                  D
                </span>
              )}
              <span
                onClick={() => startEdit('key_path')}
                className="truncate cursor-pointer rounded-lg hover:bg-gray-100 px-1 py-0.5 transition-colors"
                title={translation.key_path}
              >
                <span className="text-gray-400">{prefix}</span>
                <span className="font-medium">{lastSegment}</span>
              </span>
            </div>
          )}
        </td>
        <td className="px-3 py-2.5">{renderCell('az_value')}</td>
        <td className="px-3 py-2.5">{renderCell('en_value')}</td>
        <td className="px-3 py-2.5">{renderCell('ru_value')}</td>
      </tr>
      {showIssueFix && issue && (
        <tr className="bg-warning-light border-b border-gray-100">
          <td colSpan={4} className="px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">
                Suggested fix: <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">{issue.suggested}</code>
              </span>
              <button
                onClick={acceptIssueFix}
                disabled={saving}
                className="px-3 py-1 bg-gray-900 text-white text-xs font-medium rounded-lg
                           hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => setShowIssueFix(false)}
                className="px-3 py-1 text-gray-500 text-xs hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
