import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { ErrorPage } from '@/pages/error-page';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      extra: {
        boundary: this.props.name ?? 'unknown',
        componentStack: info.componentStack,
      },
    });
    console.error(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-background p-8">
            <ErrorPage
              error={this.state.error}
              title="Falha na interface"
              message="Ocorreu um erro inesperado ao renderizar esta tela."
              onRetry={() => window.location.reload()}
            />
          </div>
        )
      );
    }
    return this.props.children;
  }
}
