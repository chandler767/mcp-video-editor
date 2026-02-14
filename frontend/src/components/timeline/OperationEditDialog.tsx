import { useState, useEffect } from 'react'
import Tooltip from '../ui/Tooltip'
import { logger } from '../../lib/hooks/useLogs'

interface Operation {
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

interface OperationEditDialogProps {
  isOpen: boolean
  operation: Operation | null
  onClose: () => void
  onSave: (operationId: string, newParameters: Record<string, any>) => Promise<void>
  onDelete: (operationId: string) => void
}

export default function OperationEditDialog({
  isOpen,
  operation,
  onClose,
  onSave,
  onDelete,
}: OperationEditDialogProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load parameters when operation changes
  useEffect(() => {
    if (operation?.parameters) {
      setParameters({ ...operation.parameters })
      setError(null)
    }
  }, [operation])

  if (!isOpen || !operation) return null

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      logger.info(`Saving edited operation: ${operation.name}`, 'OperationEditDialog', parameters)

      await onSave(operation.id, parameters)

      logger.info(`Operation saved successfully: ${operation.name}`, 'OperationEditDialog')
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save operation'
      setError(errorMessage)
      logger.error(`Failed to save operation: ${errorMessage}`, 'OperationEditDialog', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this operation?\n\n${operation.name}`)) {
      logger.info(`Deleting operation: ${operation.name}`, 'OperationEditDialog')
      onDelete(operation.id)
      onClose()
    }
  }

  const handleParameterChange = (key: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const renderParameterInput = (key: string, value: any) => {
    // Handle different parameter types
    if (typeof value === 'boolean') {
      return (
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleParameterChange(key, e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">{value ? 'True' : 'False'}</span>
        </label>
      )
    }

    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
        />
      )
    }

    if (typeof value === 'string' && value.length > 100) {
      return (
        <textarea
          value={value}
          onChange={(e) => handleParameterChange(key, e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-border rounded-md bg-background font-mono text-sm"
        />
      )
    }

    // Default to text input
    return (
      <input
        type="text"
        value={String(value)}
        onChange={(e) => handleParameterChange(key, e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-md bg-background"
      />
    )
  }

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">Edit Operation</h2>
            <p className="text-sm text-muted-foreground mt-1">{operation.name}</p>
          </div>
          <Tooltip content="Close dialog">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Operation Info */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium">{operation.type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                    operation.status === 'success'
                      ? 'bg-green-100 text-green-700'
                      : operation.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {operation.status}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Executed:</span>
                <span className="ml-2 font-medium">{formatTimestamp(operation.timestamp)}</span>
              </div>
              {operation.input && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Input:</span>
                  <p className="mt-1 text-xs font-mono bg-background px-2 py-1 rounded break-all">
                    {operation.input}
                  </p>
                </div>
              )}
              {operation.output && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Output:</span>
                  <p className="mt-1 text-xs font-mono bg-background px-2 py-1 rounded break-all">
                    {operation.output}
                  </p>
                </div>
              )}
              {operation.error && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-red-600">Error:</span>
                  <p className="mt-1 text-xs font-mono bg-red-50 text-red-700 px-2 py-1 rounded">
                    {operation.error}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Parameters Editor */}
          <div>
            <h3 className="font-semibold mb-3">Parameters</h3>
            {Object.keys(parameters).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No parameters to edit
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(parameters).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-2">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </label>
                    {renderParameterInput(key, value)}
                    <p className="text-xs text-muted-foreground mt-1">
                      Type: {typeof value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <span className="text-red-600 text-lg">⚠️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-900">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 <strong>Tip:</strong> Saving will re-execute this operation with the new
              parameters. This will create a new output file and update the timeline.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between">
          <Tooltip content="Delete this operation from timeline">
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              🗑️ Delete
            </button>
          </Tooltip>
          <div className="flex space-x-3">
            <Tooltip content="Cancel without saving">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </Tooltip>
            <Tooltip content="Save and re-execute with new parameters">
              <button
                onClick={handleSave}
                disabled={isSaving || Object.keys(parameters).length === 0}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '⏳ Saving...' : '💾 Save & Re-execute'}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
