import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 1. Global Window Error Listeners
let errorScreenDisplayed = false;

if (typeof window !== 'undefined') {
  window.onerror = function(message, source, lineno, colno, error) {
    if (errorScreenDisplayed) return false;
    errorScreenDisplayed = true;
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="background: #1e1b4b; color: #e0e7ff; padding: 32px; font-family: monospace; min-height: 100vh; box-sizing: border-box;">
          <h1 style="font-size: 24px; color: #f43f5e; margin-bottom: 16px; border-bottom: 2px solid #f43f5e; padding-bottom: 8px;">Browser Runtime Error</h1>
          <p><strong>Message:</strong> ${message}</p>
          <p><strong>Source:</strong> ${source}</p>
          <p><strong>Line:</strong> ${lineno} <strong>Column:</strong> ${colno}</p>
          ${error && error.stack ? `<pre style="background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 8px; overflow-x: auto; margin-top: 16px; color: #fda4af;">${error.stack}</pre>` : ''}
        </div>
      `;
    }
    return false;
  };

  window.addEventListener('unhandledrejection', function(event) {
    if (errorScreenDisplayed) return;
    errorScreenDisplayed = true;
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="background: #1e1b4b; color: #e0e7ff; padding: 32px; font-family: monospace; min-height: 100vh; box-sizing: border-box;">
          <h1 style="font-size: 24px; color: #f43f5e; margin-bottom: 16px; border-bottom: 2px solid #f43f5e; padding-bottom: 8px;">Unhandled Promise Rejection</h1>
          <p><strong>Reason:</strong> ${event.reason}</p>
          ${event.reason && event.reason.stack ? `<pre style="background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 8px; overflow-x: auto; margin-top: 16px; color: #fda4af;">${event.reason.stack}</pre>` : ''}
        </div>
      `;
    }
  });
}

// 2. React Error Boundary Component
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside React Tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (errorScreenDisplayed) return null; // Let the window error listener display it
      return (
        <div style={{ background: '#1e1b4b', color: '#e0e7ff', padding: '32px', fontFamily: 'monospace', minHeight: '100vh', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '24px', color: '#f43f5e', marginBottom: '16px', borderBottom: '2px solid #f43f5e', paddingBottom: '8px' }}>React Render Crash</h1>
          <p><strong>Message:</strong> {this.state.error?.message}</p>
          <pre style={{ background: '#0f172a', border: '1px solid #334155', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginTop: '16px', color: '#fda4af' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
