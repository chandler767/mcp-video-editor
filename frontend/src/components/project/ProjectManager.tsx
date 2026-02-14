import { useState } from 'react'
import { useProject, ProjectState } from '../../lib/hooks/useProject'
import Tooltip from '../ui/Tooltip'
import { logger } from '../../lib/hooks/useLogs'

interface ProjectManagerProps {
  isOpen: boolean
  onClose: () => void
  onProjectLoad: (project: ProjectState) => void
}

export default function ProjectManager({ isOpen, onClose, onProjectLoad }: ProjectManagerProps) {
  const {
    currentProject,
    createProject,
    loadProject,
    exportProject,
    importProject,
    getProjectsList,
    deleteProject,
  } = useProject()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projectsList = getProjectsList()

  if (!isOpen) return null

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const project = createProject(newProjectName.trim(), newProjectDescription.trim() || undefined)
      onProjectLoad(project)

      setNewProjectName('')
      setNewProjectDescription('')
      setShowCreateDialog(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadProject = async (projectId: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const project = loadProject(projectId)
      if (project) {
        onProjectLoad(project)
        onClose()
      } else {
        setError('Project not found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportProject = () => {
    try {
      exportProject()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export project')
    }
  }

  const handleImportProject = async () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.mcpvideo,.json'

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        try {
          setIsLoading(true)
          setError(null)

          const project = await importProject(file)
          onProjectLoad(project)
          onClose()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to import project')
        } finally {
          setIsLoading(false)
        }
      }

      input.click()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file picker')
    }
  }

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete project "${projectName}"?\n\nThis action cannot be undone.`)) {
      try {
        deleteProject(projectId)
        logger.info(`Project deleted: ${projectName}`, 'ProjectManager')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete project')
      }
    }
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">Project Manager</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create, load, or manage your video editing projects
            </p>
          </div>
          <Tooltip content="Close project manager">
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Current Project */}
          {currentProject && (
            <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-primary">Current Project</h3>
                  <p className="text-lg font-medium mt-1">{currentProject.name}</p>
                  {currentProject.metadata?.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentProject.metadata.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                    <span>📁 {currentProject.files.length} files</span>
                    <span>⚙️ {currentProject.operations.length} operations</span>
                    <span>🕒 Updated {formatDate(currentProject.updatedAt)}</span>
                  </div>
                </div>
                <Tooltip content="Export current project as file">
                  <button
                    onClick={handleExportProject}
                    className="px-3 py-2 text-sm border border-primary text-primary rounded-md hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    💾 Export
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <span className="text-red-600 text-lg">⚠️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-900">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Tooltip content="Create a new empty project">
              <button
                onClick={() => setShowCreateDialog(true)}
                disabled={isLoading}
                className="p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                <div className="text-4xl mb-2">➕</div>
                <h4 className="font-semibold">New Project</h4>
                <p className="text-xs text-muted-foreground mt-1">Start from scratch</p>
              </button>
            </Tooltip>

            <Tooltip content="Import a project from .mcpvideo file">
              <button
                onClick={handleImportProject}
                disabled={isLoading}
                className="p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                <div className="text-4xl mb-2">📥</div>
                <h4 className="font-semibold">Import Project</h4>
                <p className="text-xs text-muted-foreground mt-1">Load from file</p>
              </button>
            </Tooltip>

            <Tooltip content="Browse example project templates">
              <button
                disabled
                className="p-6 border-2 border-dashed border-border rounded-lg opacity-50 cursor-not-allowed"
              >
                <div className="text-4xl mb-2">📚</div>
                <h4 className="font-semibold">Templates</h4>
                <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
              </button>
            </Tooltip>
          </div>

          {/* Recent Projects */}
          <div>
            <h3 className="font-semibold mb-3">Recent Projects ({projectsList.length})</h3>
            {projectsList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-4xl mb-3">📂</div>
                <p className="text-sm">No projects yet</p>
                <p className="text-xs mt-1">Create a new project to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectsList.map((project) => (
                  <div
                    key={project.id}
                    className="group flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleLoadProject(project.id)}
                    >
                      <h4 className="font-medium">{project.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {formatDate(project.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip content="Load this project">
                        <button
                          onClick={() => handleLoadProject(project.id)}
                          disabled={isLoading}
                          className="px-3 py-1 text-xs border border-border rounded hover:bg-secondary transition-colors"
                        >
                          📂 Load
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete this project">
                        <button
                          onClick={() => handleDeleteProject(project.id, project.name)}
                          className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          🗑️
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 bg-secondary/30">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>

      {/* Create Project Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-bold">Create New Project</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Video Project"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Brief description of this project..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="border-t border-border px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateDialog(false)
                  setNewProjectName('')
                  setNewProjectDescription('')
                  setError(null)
                }}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isLoading}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '⏳ Creating...' : '✨ Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
