import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

type State = { error: Error | null; info: string | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error, info)
    this.setState({ info: info.componentStack ?? null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-background p-6 text-sm">
        <h1 className="mb-2 text-lg font-semibold">Une erreur s'est produite</h1>
        <p className="mb-4 text-muted-foreground">
          Voici le détail si tu veux nous l'envoyer (capture d'écran) :
        </p>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
          {this.state.error.name}: {this.state.error.message}
          {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
          {this.state.info ? `\n\nComponent stack:${this.state.info}` : ''}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Recharger la page
        </Button>
      </div>
    )
  }
}
