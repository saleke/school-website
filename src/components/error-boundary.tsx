"use client";

import { Component, ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-surface-1 px-6 py-12 text-center" role="alert">
            <span className="text-3xl" aria-hidden="true">!</span>
            <h3 className="font-display mt-3 text-lg font-semibold">Something went wrong</h3>
            <p className="mt-1 max-w-sm text-sm text-text-secondary">
              {this.state.error?.message ?? "An unexpected error occurred. Please try refreshing the page."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-surface-2"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
