import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches unhandled JS errors in the component tree
 * and shows a recovery UI instead of crashing the entire app.
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
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          dir="rtl"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "var(--font-family, system-ui, sans-serif)",
            color: "var(--ink, #333)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>حدث خطأ غير متوقع</h2>
          <p style={{ margin: "0 0 1.5rem", opacity: 0.7, maxWidth: "400px" }}>
            نعتذر عن هذا الخطأ. يمكنك المحاولة مرة أخرى أو إعادة تحميل الصفحة.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "0.5rem 1.5rem",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent, #2563eb)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              إعادة المحاولة
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1.5rem",
                borderRadius: "8px",
                border: "1px solid var(--border, #ccc)",
                background: "transparent",
                color: "var(--ink, #333)",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              إعادة تحميل
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                marginTop: "2rem",
                padding: "1rem",
                background: "var(--bg-secondary, #f5f5f5)",
                borderRadius: "8px",
                fontSize: "0.75rem",
                maxWidth: "600px",
                overflow: "auto",
                textAlign: "left",
                direction: "ltr",
              }}
            >
              {this.state.error.message}
              {"\n"}
              {import.meta.env.DEV ? this.state.error["stack"] : null}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

