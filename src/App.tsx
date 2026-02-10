import { useState, useEffect } from 'react'
import type { Translation, Project } from './types'
import { supabase } from './supabaseClient'
import LoginPage from './components/LoginPage'
import UploadView from './components/UploadView'
import TableView from './components/TableView'
import ExportView from './components/ExportView'

type View = 'translations' | 'upload' | 'export'

const NAV_ITEMS: { key: View; label: string; icon: React.ReactNode }[] = [
  {
    key: 'translations',
    label: 'Translations',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    key: 'upload',
    label: 'Upload',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    key: 'export',
    label: 'Export',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
]

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [currentView, setCurrentView] = useState<View>('translations')
  const [translations, setTranslations] = useState<Translation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('tm_authenticated')
    if (saved === 'true') setAuthenticated(true)
  }, [])

  useEffect(() => {
    if (authenticated) fetchProjects()
  }, [authenticated])

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at')

    if (data && data.length > 0) {
      setProjects(data)
      const savedProject = localStorage.getItem('tm_selected_project')
      const exists = data.find((p: Project) => p.id === savedProject)
      setSelectedProjectId(exists ? savedProject : data[0].id)
    } else if (data) {
      setProjects([])
    }
  }

  async function createProject() {
    const name = newProjectName.trim()
    if (!name) return

    const { data, error } = await supabase
      .from('projects')
      .insert({ name })
      .select()
      .single()

    if (!error && data) {
      setProjects((prev) => [...prev, data])
      setSelectedProjectId(data.id)
      localStorage.setItem('tm_selected_project', data.id)
      setNewProjectName('')
      setShowNewProject(false)
    }
  }

  function selectProject(id: string) {
    if (id === selectedProjectId) return
    setSelectedProjectId(id)
    localStorage.setItem('tm_selected_project', id)
    setTranslations([])
  }

  async function deleteProject(id: string) {
    const project = projects.find((p) => p.id === id)
    if (!project || !confirm(`Delete "${project.name}" and all its translations?`)) return

    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return

    const remaining = projects.filter((p) => p.id !== id)
    setProjects(remaining)

    if (selectedProjectId === id) {
      const next = remaining.length > 0 ? remaining[0].id : null
      setSelectedProjectId(next)
      setTranslations([])
      if (next) localStorage.setItem('tm_selected_project', next)
      else localStorage.removeItem('tm_selected_project')
    }

    setContextMenu(null)
  }

  function handleLogout() {
    localStorage.removeItem('tm_authenticated')
    setAuthenticated(false)
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />
  }

  return (
    <div className="flex h-screen bg-white" onClick={() => contextMenu && setContextMenu(null)}>
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5">
          <img src="/croccontent.png" alt="croc/content" className="h-8 w-auto object-contain" />
        </div>

        {/* Project selector */}
        <div className="px-3 mb-4">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider px-3 mb-1.5 block">
            Project
          </label>
          <div className="space-y-0.5">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, projectId: p.id })
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedProjectId === p.id
                    ? 'bg-accent-light text-accent font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.name}
              </button>
            ))}
            {showNewProject ? (
              <div className="flex gap-1 px-1">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createProject()
                    if (e.key === 'Escape') setShowNewProject(false)
                  }}
                  placeholder="Project name"
                  autoFocus
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    createProject()
                  }}
                  className="px-2 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 cursor-pointer"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                + New project
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 mx-3 mb-2" />

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key)}
              disabled={!selectedProjectId}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                currentView === item.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400
                       hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {!selectedProjectId ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Create a project to get started.
            </div>
          ) : (
            <>
              {currentView === 'translations' && (
                <TableView
                  projectId={selectedProjectId}
                  translations={translations}
                  setTranslations={setTranslations}
                  refreshKey={refreshKey}
                />
              )}
              {currentView === 'upload' && (
                <UploadView
                  projectId={selectedProjectId}
                  onUploadComplete={() => {
                    setRefreshKey((k) => k + 1)
                    setCurrentView('translations')
                  }}
                />
              )}
              {currentView === 'export' && (
                <ExportView
                  projectId={selectedProjectId}
                  translations={translations}
                />
              )}
            </>
          )}
        </div>
      </main>

      {contextMenu && (
        <div
          className="fixed bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteProject(contextMenu.projectId)
            }}
            className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger-light transition-colors"
          >
            Delete project
          </button>
        </div>
      )}
    </div>
  )
}
