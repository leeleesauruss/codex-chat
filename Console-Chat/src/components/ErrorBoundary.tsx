import type { PropsWithChildren } from 'react';
import { Component } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  stack?: string;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface component stack in production builds for debugging.
    console.error('Renderer crashed:', error);
    console.error('Component stack:', info.componentStack);
    this.setState({ stack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{ padding: '1rem', color: '#c00' }}>
        <h2>Renderer Error</h2>
        <p>{this.state.message}</p>
        {this.state.stack && (
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.stack}</pre>
        )}
      </div>
    );
  }
}
