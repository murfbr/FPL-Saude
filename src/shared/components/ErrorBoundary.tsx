import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Detects if an error was caused by external DOM manipulation
 * (e.g., browser translators, extensions) rather than an actual app bug.
 */
function isDomManipulationError(error: Error): boolean {
  const msg = error.message || ''
  return (
    msg.includes('removeChild') ||
    msg.includes('insertBefore') ||
    msg.includes('appendChild') ||
    msg.includes('NotFoundError') ||
    msg.includes('not a child of this node') ||
    msg.includes('Failed to execute') && msg.includes('on \'Node\'')
  )
}

export class ErrorBoundary extends Component<Props, State> {
  private recoveryAttempts = 0
  private static MAX_RECOVERY_ATTEMPTS = 3

  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // If this is a DOM manipulation error from a browser extension/translator,
    // try to auto-recover instead of crashing the app
    if (isDomManipulationError(error) && this.recoveryAttempts < ErrorBoundary.MAX_RECOVERY_ATTEMPTS) {
      this.recoveryAttempts++
      console.warn(
        `[ErrorBoundary] DOM manipulation error detected (attempt ${this.recoveryAttempts}/${ErrorBoundary.MAX_RECOVERY_ATTEMPTS}). Auto-recovering...`,
        error.message,
      )
      // Reset the error state to re-render children
      this.setState({ hasError: false, error: null })
      return
    }

    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full border-destructive/20 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-destructive/10 text-destructive rounded-full p-4 w-fit mb-4">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl">Algo deu errado</CardTitle>
              <CardDescription>
                Ocorreu um erro crítico e a aplicação não pode continuar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {this.state.error && (
                <div className="p-3 bg-muted/50 rounded-md text-xs font-mono text-muted-foreground break-all max-h-[150px] overflow-y-auto border">
                  {this.state.error.message}
                </div>
              )}
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
                variant="default"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Recarregar Aplicação
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
