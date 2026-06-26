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
        <div className="rounded-lg bg-red-950/50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-300">Something went wrong</p>
          <p className="mt-2 text-xs text-red-400/80">
            {this.state.error.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
