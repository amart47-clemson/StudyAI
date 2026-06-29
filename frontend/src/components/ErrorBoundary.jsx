import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="rounded-lg px-4 py-6 text-center"
          style={{ background: 'rgba(239, 68, 68, 0.08)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
            Something went wrong
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {this.state.error.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="btn-primary mt-4 max-w-xs"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
