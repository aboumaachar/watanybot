import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const RELOAD_GUARD_KEY = "watany:error-boundary:chunk-reload-once";
const WARN_ICON = "\u26A0\uFE0F";
const TITLE_AR = "\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639";
const BODY_AR = "\u0646\u0639\u062a\u0630\u0631 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u062e\u0637\u0623. \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0623\u0648 \u0625\u0639\u0627\u062f\u0629 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629.";
const RETRY_AR = "\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629";
const RELOAD_AR = "\u0625\u0639\u0627\u062f\u0629 \u062a\u062d\u0645\u064a\u0644";

function isLikelyChunkLoadError(error: Error): boolean {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    msg.includes("chunkloaderror")
  );
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

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (!this.state.hasError || prevState.error === this.state.error || !this.state.error) return;
    if (!isLikelyChunkLoadError(this.state.error)) return;

    const alreadyRetried = window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
    if (alreadyRetried) return;

    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    window.location.reload();
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
    }
  }

  handleRetry = () => {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
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
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{WARN_ICON}</div>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>{TITLE_AR}</h2>
          <p style={{ margin: "0 0 1.5rem", opacity: 0.7, maxWidth: "400px" }}>
            {BODY_AR}
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
              {RETRY_AR}
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
              {RELOAD_AR}
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


