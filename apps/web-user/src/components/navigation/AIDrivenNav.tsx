/**
 * AIDrivenNav — No visible navigation chrome.
 * Just a subtle hint telling the user to ask the chatbot for navigation.
 */
export function AIDrivenNav({
  onNavigate,
}: {
  readonly onNavigate: (id: string) => void;
}) {
  // This nav is intentionally minimal — the AI routes the user
  // We expose onNavigate for programmatic use by the chat AI intents
  void onNavigate; // kept for API compatibility

  return (
    <div className="nav-ai-driven">
      <div className="nav-ai-hint ds-card">
        قُل للمساعد ما تحتاجهه: «أريد حساب راتبي» أو «افتح قضاياي»
      </div>
    </div>
  );
}
