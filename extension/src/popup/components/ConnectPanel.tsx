import { useState } from "react";
import type { ProviderId } from "../../types/usage";
import { PROVIDER_LABELS } from "../../types/usage";

type ConnectPanelProps = {
  provider: ProviderId;
  connecting?: boolean;
  onClose: () => void;
  onConnect: (
    provider: ProviderId,
    sessionToken: string,
    orgId?: string,
  ) => void;
  onImportCookie?: () => void;
};

const INSTRUCTIONS: Record<ProviderId, string> = {
  cursor:
    "Log in at cursor.com, then import your browser session below. You can also paste WorkosCursorSessionToken from DevTools → Cookies.",
  chatgpt:
    "Log in at chatgpt.com (Codex uses your ChatGPT account), then import your browser session. You can also paste a JWT access token or Cookie header from DevTools.",
  claude:
    "Log in at claude.ai, then import your browser session. You can also paste the sessionKey cookie from DevTools → Cookies.",
};

export function ConnectPanel({
  provider,
  connecting = false,
  onClose,
  onConnect,
  onImportCookie,
}: ConnectPanelProps) {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Connect {PROVIDER_LABELS[provider]}</h2>
        <p>{INSTRUCTIONS[provider]}</p>

        {onImportCookie && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onImportCookie}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Import from browser session"}
            </button>
            <div className="divider">or paste token</div>
          </>
        )}

        <label htmlFor="session-token">Session token or cookie header</label>
        <textarea
          id="session-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={
            provider === "chatgpt"
              ? "Paste access token or Cookie header from chatgpt.com…"
              : "Paste token here…"
          }
          spellCheck={false}
        />

        {provider === "claude" && (
          <>
            <label htmlFor="org-id">Organization ID (optional)</label>
            <input
              id="org-id"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Auto-detected if left blank"
            />
          </>
        )}

        <div className="panel-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={connecting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!token.trim() || connecting}
            onClick={() => onConnect(provider, token, orgId || undefined)}
          >
            {connecting ? "Connecting…" : "Save & fetch"}
          </button>
        </div>
      </div>
    </div>
  );
}
