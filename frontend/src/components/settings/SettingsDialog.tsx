import { useState } from 'react'
import WorkspaceSettings from './WorkspaceSettings'
import ProjectSettings from './ProjectSettings'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'project'>('workspace')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Settings</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mt-4">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === 'workspace'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => setActiveTab('project')}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                activeTab === 'project'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Project
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'workspace' && <WorkspaceSettings />}
          {activeTab === 'project' && <ProjectSettings />}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
