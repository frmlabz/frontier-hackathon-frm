// @bos/entry — mounts a generated App inside the iframe and reports ready/error to the shell.
import { Component, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "./ui.tsx";

const post = (msg: any) => {
  try {
    window.parent?.postMessage(msg, location.origin);
  } catch {}
};
let reported = false;
const reportError = (message: string, stack?: string) => {
  if (reported) return; // one report per load is enough for auto-fix
  reported = true;
  post({ type: "bos:error", message: String(message).slice(0, 2000), stack: String(stack ?? "").slice(0, 4000) });
};

window.addEventListener("error", (e) => reportError(e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => reportError(e.reason?.message ?? String(e.reason), e.reason?.stack));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    reportError(error.message, error.stack);
  }
  override render() {
    if (this.state.error)
      return (
        <div className="bos-crash">
          <div className="bos-crash-emoji">🛠️</div>
          <p>This app hit a snag. Your data is safe.</p>
        </div>
      );
    return this.props.children;
  }
}

export function mount(App: ComponentType) {
  const el = document.getElementById("root")!;
  createRoot(el).render(
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>,
  );
  // Ready after first paint.
  requestAnimationFrame(() => requestAnimationFrame(() => post({ type: "bos:ready" })));
}
