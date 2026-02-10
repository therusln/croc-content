import React, { useState, useEffect, useMemo } from 'react'
import type { Translation, KeyIssue, DuplicateGroup } from '../types'
import { supabase } from '../supabaseClient'
import { analyzeKeyIssues } from '../utils/keyOptimizer'
import { findDuplicateValues } from '../utils/duplicateDetector'
import TableRow from './TableRow'

interface TableViewProps {
  translations: Translation[]
  setTranslations: React.Dispatch<React.SetStateAction<Translation[]>>
  projectId: string
  refreshKey: number
}

export default function TableView({ translations, setTranslations, projectId, refreshKey }: TableViewProps) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'all' | 'issues' | 'duplicates'>('all')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; translationId: string } | null>(null)
  const [ignoredDuplicates, setIgnoredDuplicates] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTranslations()

    const channel = supabase
      .channel(`translations-realtime-${projectId}-${refreshKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'translations', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTranslations((prev) => [...prev, payload.new as Translation])
          } else if (payload.eventType === 'UPDATE') {
            setTranslations((prev) =>
              prev.map((t) => (t.id === (payload.new as Translation).id ? (payload.new as Translation) : t)),
            )
          } else if (payload.eventType === 'DELETE') {
            setTranslations((prev) =>
              prev.filter((t) => t.id !== (payload.old as { id: string }).id),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [setTranslations, projectId, refreshKey])

  async function fetchTranslations() {
    setLoading(true)
    const { data, error } = await supabase
      .from('translations')
      .select('*')
      .eq('project_id', projectId)
      .order('key_path')

    if (!error && data) {
      setTranslations(data)
    }
    setLoading(false)
  }

  const issues = useMemo(() => {
    const map = new Map<string, KeyIssue>()
    for (const t of translations) {
      const issue = analyzeKeyIssues(t.key_path)
      if (issue) map.set(t.key_path, issue)
    }
    return map
  }, [translations])

  const duplicates = useMemo(() => {
    return findDuplicateValues(translations)
  }, [translations])

  const activeDuplicates = useMemo(() => {
    return duplicates.filter((g) => !ignoredDuplicates.has(`${g.language}::${g.value}`))
  }, [duplicates, ignoredDuplicates])

  const duplicateKeyPaths = useMemo(() => {
    const set = new Set<string>()
    for (const group of activeDuplicates) {
      for (const kp of group.keyPaths) set.add(kp)
    }
    return set
  }, [activeDuplicates])

  // Map from key_path to its duplicate groups (for showing context in TableRow)
  const duplicateInfo = useMemo(() => {
    const map = new Map<string, DuplicateGroup[]>()
    for (const group of activeDuplicates) {
      for (const kp of group.keyPaths) {
        const existing = map.get(kp) || []
        existing.push(group)
        map.set(kp, existing)
      }
    }
    return map
  }, [activeDuplicates])

  function matchesSearch(t: Translation, q: string): boolean {
    return (
      t.key_path.toLowerCase().includes(q) ||
      (t.original_key?.toLowerCase().includes(q) ?? false) ||
      (t.az_value?.toLowerCase().includes(q) ?? false) ||
      (t.en_value?.toLowerCase().includes(q) ?? false) ||
      (t.ru_value?.toLowerCase().includes(q) ?? false)
    )
  }

  // Grouped duplicates for the duplicates filter view
  const groupedDuplicates = useMemo(() => {
    if (filterMode !== 'duplicates') return []

    const langLabel: Record<string, string> = { az: 'AZ', en: 'EN', ru: 'RU' }
    const translationMap = new Map<string, Translation>()
    for (const t of translations) {
      translationMap.set(t.key_path, t)
    }

    return activeDuplicates.map((group) => {
      let rows = group.keyPaths
        .map((kp) => translationMap.get(kp))
        .filter((t): t is Translation => !!t)

      if (search) {
        const q = search.toLowerCase()
        rows = rows.filter((t) => matchesSearch(t, q))
      }

      return {
        group,
        label: `${langLabel[group.language]}: "${group.value.length > 80 ? group.value.slice(0, 80) + '…' : group.value}"`,
        rows,
      }
    }).filter((g) => g.rows.length > 0)
  }, [filterMode, activeDuplicates, translations, search])

  const filtered = useMemo(() => {
    let result = translations

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) => matchesSearch(t, q))
    }

    if (filterMode === 'issues') {
      result = result.filter((t) => issues.has(t.key_path))
    } else if (filterMode === 'duplicates') {
      result = result.filter((t) => duplicateKeyPaths.has(t.key_path))
    }

    return result
  }, [translations, search, filterMode, issues, duplicateKeyPaths])

  function handleUpdate(updated: Translation) {
    setTranslations((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)),
    )
  }

  function handleRowContextMenu(e: React.MouseEvent, translationId: string) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, translationId })
  }

  async function deleteTranslation(id: string) {
    const { error } = await supabase.from('translations').delete().eq('id', id)
    if (!error) {
      setTranslations((prev) => prev.filter((t) => t.id !== id))
    }
    setContextMenu(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading translations...
      </div>
    )
  }

  return (
    <div className="space-y-4" onClick={() => contextMenu && setContextMenu(null)}>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys or values..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50
                       focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                       placeholder:text-gray-400 transition-all"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            ['all', 'All'],
            ['issues', `Issues (${issues.size})`],
            ['duplicates', `Duplicates (${activeDuplicates.length})`],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterMode === mode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {translations.length} tokens
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ maxWidth: 600 }}>
                  Key Path
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: 220 }}>
                  AZ
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: 220 }}>
                  EN
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: 220 }}>
                  RU
                </th>
              </tr>
            </thead>
            <tbody>
              {filterMode === 'duplicates' ? (
                groupedDuplicates.map((group, gi) => (
                  <React.Fragment key={`dup-group-${gi}`}>
                    <tr className="bg-danger-light/50">
                      <td colSpan={4} className="px-4 py-2 text-xs font-medium text-danger">
                        <span className="inline-flex items-center gap-1.5 w-full">
                          <span className="w-4 h-4 rounded-full bg-danger text-white text-[10px] flex items-center justify-center shrink-0">
                            {group.rows.length}
                          </span>
                          Duplicate value in {group.label}
                          <button
                            onClick={() => {
                              setIgnoredDuplicates((prev) => {
                                const next = new Set(prev)
                                next.add(`${group.group.language}::${group.group.value}`)
                                return next
                              })
                            }}
                            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Ignore
                          </button>
                        </span>
                      </td>
                    </tr>
                    {group.rows.map((t) => (
                      <TableRow
                        key={t.id}
                        translation={t}
                        issue={issues.get(t.key_path) || null}
                        isDuplicate={true}
                        duplicateGroups={duplicateInfo.get(t.key_path) || null}
                        onUpdate={handleUpdate}
                        onContextMenu={(e) => handleRowContextMenu(e, t.id)}
                        indented
                      />
                    ))}
                  </React.Fragment>
                ))
              ) : (
                filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    translation={t}
                    issue={issues.get(t.key_path) || null}
                    isDuplicate={duplicateKeyPaths.has(t.key_path)}
                    duplicateGroups={duplicateInfo.get(t.key_path) || null}
                    onUpdate={handleUpdate}
                    onContextMenu={(e) => handleRowContextMenu(e, t.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            {translations.length === 0
              ? 'No translations yet. Upload JSON files to get started.'
              : 'No results match your search.'}
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteTranslation(contextMenu.translationId)
            }}
            className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger-light transition-colors"
          >
            Delete token
          </button>
        </div>
      )}
    </div>
  )
}
