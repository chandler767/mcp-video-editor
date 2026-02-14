import { formatShortcut, KeyboardShortcut } from '../../lib/hooks/useKeyboardShortcuts'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
}

export default function KeyboardShortcutsHelp({
  isOpen,
  onClose,
  shortcuts,
}: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  // Group shortcuts by category
  const categories = {
    general: shortcuts.filter((s) => s.description.includes('dialog') || s.description.includes('settings') || s.description.includes('help')),
    navigation: shortcuts.filter((s) => s.description.includes('view') || s.description.includes('tab')),
    editing: shortcuts.filter((s) => s.description.includes('Undo') || s.description.includes('Redo') || s.description.includes('clear')),
    file: shortcuts.filter((s) => s.description.includes('Open') || s.description.includes('Save') || s.description.includes('file')),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary flex items-center space-x-2">
            <span>⌨️</span>
            <span>Keyboard Shortcuts</span>
          </h2>
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
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* General */}
          {categories.general.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                General
              </h3>
              <div className="space-y-2">
                {categories.general.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50"
                  >
                    <span className="text-sm text-secondary-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-3 py-1 bg-secondary border border-border rounded text-xs font-mono">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          {categories.navigation.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                Navigation
              </h3>
              <div className="space-y-2">
                {categories.navigation.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50"
                  >
                    <span className="text-sm text-secondary-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-3 py-1 bg-secondary border border-border rounded text-xs font-mono">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editing */}
          {categories.editing.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                Editing
              </h3>
              <div className="space-y-2">
                {categories.editing.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50"
                  >
                    <span className="text-sm text-secondary-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-3 py-1 bg-secondary border border-border rounded text-xs font-mono">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Operations */}
          {categories.file.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                File Operations
              </h3>
              <div className="space-y-2">
                {categories.file.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50"
                  >
                    <span className="text-sm text-secondary-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-3 py-1 bg-secondary border border-border rounded text-xs font-mono">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help text */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-2 py-1 bg-secondary border border-border rounded text-xs font-mono">?</kbd> or{' '}
              <kbd className="px-2 py-1 bg-secondary border border-border rounded text-xs font-mono">F1</kbd>{' '}
              to show this help again
            </p>
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
    </div>
  )
}
