import { useState } from 'react'
import Tooltip from '../ui/Tooltip'

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

interface TimelineProps {
  operations: Operation[]
  onOperationClick: (operation: Operation) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export default function Timeline({
  operations,
  onOperationClick,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: TimelineProps) {
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set())

  const toggleExpanded = (opId: string) => {
    setExpandedOps((prev) => {
      const next = new Set(prev)
      if (next.has(opId)) {
        next.delete(opId)
      } else {
        next.add(opId)
      }
      return next
    })
  }

  const getOperationIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      trim_video: '✂️',
      concat: '🔗',
      resize: '📐',
      effect: '✨',
      audio: '🎵',
      text: '📝',
      export: '📤',
      color: '🎨',
      blur: '🌫️',
      default: '⚙️',
    }

    for (const [key, icon] of Object.entries(iconMap)) {
      if (type.includes(key)) return icon
    }
    return iconMap.default
  }

  const getStatusColor = (status: Operation['status']): string => {
    switch (status) {
      case 'success':
        return 'border-green-500 bg-green-50'
      case 'failed':
        return 'border-red-500 bg-red-50'
      case 'pending':
        return 'border-gray-400 bg-gray-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  if (operations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="text-4xl mb-2">📋</div>
        <p className="text-lg">No operations yet</p>
        <p className="text-sm mt-2">Operations will appear here as you edit</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Tooltip content="Undo last operation (⌘+Z)">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ↶ Undo
            </button>
          </Tooltip>
          <Tooltip content="Redo operation (⌘+⇧+Z)">
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ↷ Redo
            </button>
          </Tooltip>
        </div>

        <div className="text-sm text-muted-foreground">
          {operations.length} operation{operations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Operations List */}
      <div className="space-y-2">
        {operations.map((op, index) => (
          <div key={op.id} className="relative">
            {/* Connection Line */}
            {index > 0 && (
              <div className="absolute left-6 -top-2 w-px h-2 bg-border"></div>
            )}

            {/* Operation Card */}
            <Tooltip content="Click to view output in preview" placement="left">
              <div
                onClick={() => onOperationClick(op)}
                className={`border-l-4 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${getStatusColor(
                  op.status
                )}`}
              >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-2xl flex-shrink-0">
                    {getOperationIcon(op.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{op.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(op.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {op.type}
                    </p>

                    {op.status === 'failed' && op.error && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                        ⚠️ {op.error}
                      </div>
                    )}

                    {op.status === 'success' && op.output && (
                      <div className="mt-2 text-xs text-muted-foreground truncate">
                        📁 {op.output}
                      </div>
                    )}

                    {/* Expandable Parameters */}
                    {op.parameters && Object.keys(op.parameters).length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(op.id)
                        }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        {expandedOps.has(op.id)
                          ? '▼ Hide details'
                          : '▶ Show details'}
                      </button>
                    )}

                    {expandedOps.has(op.id) && op.parameters && (
                      <div className="mt-2 text-xs bg-white p-2 rounded border border-border">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(op.parameters, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0">
                  {op.status === 'success' && (
                    <span className="text-green-600">✓</span>
                  )}
                  {op.status === 'failed' && (
                    <span className="text-red-600">✗</span>
                  )}
                  {op.status === 'pending' && (
                    <span className="text-gray-600">⏳</span>
                  )}
                </div>
              </div>
              </div>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  )
}
