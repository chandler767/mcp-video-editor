import { useState, useCallback } from 'react'
import { logger } from './useLogs'

export interface ProjectFile {
  id: string
  name: string
  path: string
  size: number
  type: string
  duration?: number
  resolution?: string
  addedAt: number
}

export interface ProjectOperation {
  id: string
  name: string
  type: string
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  input?: string
  output?: string
  parameters?: Record<string, any>
  error?: string
}

export interface ProjectState {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  files: ProjectFile[]
  operations: ProjectOperation[]
  selectedFileId?: string
  currentVideoPath?: string
  metadata?: {
    description?: string
    tags?: string[]
    version?: string
  }
}

const CURRENT_PROJECT_KEY = 'mcp-video-editor:current-project'
const PROJECTS_LIST_KEY = 'mcp-video-editor:projects-list'

export function useProject() {
  const [currentProject, setCurrentProject] = useState<ProjectState | null>(null)

  // Create a new project
  const createProject = useCallback((name: string, description?: string): ProjectState => {
    const project: ProjectState = {
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: [],
      operations: [],
      metadata: {
        description,
        version: '1.0.0',
      },
    }

    setCurrentProject(project)
    saveProjectToStorage(project)
    addToProjectsList(project.id, project.name, project.createdAt)

    logger.info(`Created new project: ${name}`, 'useProject', { projectId: project.id })

    return project
  }, [])

  // Load a project from storage
  const loadProject = useCallback((projectId: string): ProjectState | null => {
    try {
      const stored = localStorage.getItem(`mcp-video-editor:project:${projectId}`)
      if (!stored) {
        logger.warning(`Project not found: ${projectId}`, 'useProject')
        return null
      }

      const project = JSON.parse(stored) as ProjectState
      setCurrentProject(project)

      logger.info(`Loaded project: ${project.name}`, 'useProject', { projectId })

      return project
    } catch (error) {
      logger.error(`Failed to load project: ${projectId}`, 'useProject', error)
      return null
    }
  }, [])

  // Save current project
  const saveProject = useCallback((updates?: Partial<ProjectState>) => {
    if (!currentProject) {
      logger.warning('No current project to save', 'useProject')
      return
    }

    const updatedProject: ProjectState = {
      ...currentProject,
      ...updates,
      updatedAt: Date.now(),
    }

    setCurrentProject(updatedProject)
    saveProjectToStorage(updatedProject)

    logger.info(`Saved project: ${updatedProject.name}`, 'useProject', {
      projectId: updatedProject.id,
    })
  }, [currentProject])

  // Export project as JSON file
  const exportProject = useCallback(() => {
    if (!currentProject) {
      logger.warning('No current project to export', 'useProject')
      return
    }

    const data = JSON.stringify(currentProject, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.mcpvideo`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.info(`Exported project: ${currentProject.name}`, 'useProject')
  }, [currentProject])

  // Import project from JSON file
  const importProject = useCallback((file: File): Promise<ProjectState> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const project = JSON.parse(content) as ProjectState

          // Update metadata
          project.updatedAt = Date.now()

          setCurrentProject(project)
          saveProjectToStorage(project)
          addToProjectsList(project.id, project.name, project.createdAt)

          logger.info(`Imported project: ${project.name}`, 'useProject', {
            projectId: project.id,
          })

          resolve(project)
        } catch (error) {
          logger.error('Failed to import project', 'useProject', error)
          reject(new Error('Invalid project file format'))
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read project file'))
      }

      reader.readAsText(file)
    })
  }, [])

  // Get list of all projects
  const getProjectsList = useCallback((): Array<{
    id: string
    name: string
    createdAt: number
  }> => {
    try {
      const stored = localStorage.getItem(PROJECTS_LIST_KEY)
      if (!stored) return []

      return JSON.parse(stored)
    } catch (error) {
      logger.error('Failed to get projects list', 'useProject', error)
      return []
    }
  }, [])

  // Delete a project
  const deleteProject = useCallback((projectId: string) => {
    try {
      // Remove from storage
      localStorage.removeItem(`mcp-video-editor:project:${projectId}`)

      // Remove from projects list
      const list = getProjectsList()
      const updated = list.filter((p) => p.id !== projectId)
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(updated))

      // Clear current project if it's the one being deleted
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        localStorage.removeItem(CURRENT_PROJECT_KEY)
      }

      logger.info(`Deleted project: ${projectId}`, 'useProject')
    } catch (error) {
      logger.error(`Failed to delete project: ${projectId}`, 'useProject', error)
    }
  }, [currentProject, getProjectsList])

  // Update project files
  const updateProjectFiles = useCallback(
    (files: ProjectFile[]) => {
      if (!currentProject) return

      saveProject({ files })
    },
    [currentProject, saveProject]
  )

  // Update project operations
  const updateProjectOperations = useCallback(
    (operations: ProjectOperation[]) => {
      if (!currentProject) return

      saveProject({ operations })
    },
    [currentProject, saveProject]
  )

  // Update selected file
  const updateSelectedFile = useCallback(
    (fileId: string, videoPath?: string) => {
      if (!currentProject) return

      saveProject({
        selectedFileId: fileId,
        currentVideoPath: videoPath,
      })
    },
    [currentProject, saveProject]
  )

  return {
    currentProject,
    createProject,
    loadProject,
    saveProject,
    exportProject,
    importProject,
    getProjectsList,
    deleteProject,
    updateProjectFiles,
    updateProjectOperations,
    updateSelectedFile,
  }
}

// Helper functions

function saveProjectToStorage(project: ProjectState) {
  try {
    localStorage.setItem(`mcp-video-editor:project:${project.id}`, JSON.stringify(project))
    localStorage.setItem(CURRENT_PROJECT_KEY, project.id)
  } catch (error) {
    console.error('Failed to save project to storage:', error)
  }
}

function addToProjectsList(id: string, name: string, createdAt: number) {
  try {
    const stored = localStorage.getItem(PROJECTS_LIST_KEY)
    const list = stored ? JSON.parse(stored) : []

    // Remove if already exists (in case of re-import)
    const filtered = list.filter((p: any) => p.id !== id)

    // Add to front
    filtered.unshift({ id, name, createdAt })

    localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to update projects list:', error)
  }
}
