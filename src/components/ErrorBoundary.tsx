import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches unhandled React render errors and shows a
 * recovery UI instead of a blank / crashed screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          gap: "1.2rem",
          padding: "2rem",
          textAlign: "center",
          background: "var(--cream, #faf9f7)",
          fontFamily: "inherit",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>⚠️</div>
        <h2
          style={{
            fontSize: "1.3rem",
            fontWeight: 500,
            color: "var(--text-dark, #1a1a1a)",
            margin: 0,
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-muted, #888)",
            maxWidth: 420,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {this.state.error?.message ?? "An unexpected error occurred."}
        </p>
        <button
          className="btn btn--primary"
          onClick={this.handleRetry}
          style={{ marginTop: "0.5rem" }}
        >
          Try Again
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => window.location.reload()}
          style={{ fontSize: "0.85rem" }}
        >
          Reload Page
        </button>
      </div>
    );
  }
}
