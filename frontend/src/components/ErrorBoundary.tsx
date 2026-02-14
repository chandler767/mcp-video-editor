import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
          <div className="max-w-2xl w-full bg-card border border-border rounded-lg p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="text-4xl">⚠️</div>
              <div>
                <h1 className="text-2xl font-bold text-primary">
                  Something went wrong
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  An unexpected error occurred in the application
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-secondary/50 rounded-md p-4 mb-6">
                <h2 className="text-sm font-semibold mb-2">Error Details:</h2>
                <pre className="text-xs text-muted-foreground overflow-x-auto">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="mb-6">
                <summary className="cursor-pointer text-sm font-semibold hover:text-primary">
                  Component Stack
                </summary>
                <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto bg-secondary/50 rounded-md p-4">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Reload App
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              If this problem persists, please report it on{' '}
              <a
                href="https://github.com/chandler767/mcp-video-editor/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
