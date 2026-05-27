'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030303',
          color: '#999',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, marginBottom: 16 }}>Reload the page to try again.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999,
                background: 'transparent',
                color: '#fff',
                fontSize: 13,
                padding: '8px 20px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
