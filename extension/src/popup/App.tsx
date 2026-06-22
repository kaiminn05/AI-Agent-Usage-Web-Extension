import { useCallback, useEffect, useState } from "react";
import type { MessageResponse, MessageType } from "../messages";
import { POPUP_REFRESH_SECONDS } from "../storage/usage-cache";
import type { ProviderId, UsageSnapshot } from "../types/usage";
import { PROVIDER_LABELS } from "../types/usage";
import { formatFetchedAt } from "../utils/datetime";
import { ConnectPanel } from "./components/ConnectPanel";
import { AppFooter } from "./components/AppFooter";
import { ProviderCard } from "./components/ProviderCard";
import { UpdateNotice } from "./components/UpdateNotice";

const PROVIDERS: ProviderId[] = ["cursor", "chatgpt", "claude"];
const MESSAGE_TIMEOUT_MS = 120_000;

async function sendMessage(message: MessageType): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Request timed out — try reloading the extension."));
    }, MESSAGE_TIMEOUT_MS);

    chrome.runtime.sendMessage(message, (response: MessageResponse | undefined) => {
      window.clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(
          new Error(
            "No response from extension background — reload the extension in chrome://extensions.",
          ),
        );
        return;
      }

      resolve(response);
    });
  });
}

function latestFetchedAt(
  snapshots: Record<ProviderId, UsageSnapshot | undefined>,
): string | null {
  const latest = Object.values(snapshots)
    .filter((snapshot): snapshot is UsageSnapshot => Boolean(snapshot?.fetchedAt))
    .map((snapshot) => snapshot.fetchedAt)
    .sort()
    .at(-1);

  return latest ?? null;
}

export default function App() {
  const [snapshots, setSnapshots] = useState<
    Record<ProviderId, UsageSnapshot | undefined>
  >({
    chatgpt: undefined,
    claude: undefined,
    cursor: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<ProviderId | null>(
    null,
  );
  const [connecting, setConnecting] = useState(false);

  const applySnapshots = useCallback(
    (next: Record<ProviderId, UsageSnapshot | undefined>) => {
      setSnapshots(next);
      const latest = latestFetchedAt(next);
      if (latest) setLastUpdated(latest);
    },
    [],
  );

  const load = useCallback(
    async (refresh = false, silent = false) => {
      if (!silent) {
        setError(null);
        if (refresh) setRefreshing(true);
        else setLoading(true);
      }

      try {
        const response = await sendMessage({
          type: refresh ? "REFRESH_USAGE" : "GET_USAGE",
        });

        if (!response.ok) {
          if (!silent) setError(response.error);
          return;
        }

        applySnapshots(response.snapshots);
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error ? err.message : "Failed to load usage data.",
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applySnapshots],
  );

  useEffect(() => {
    void (async () => {
      await load(false, false);
      void load(true, true);
    })();

    const intervalId = window.setInterval(() => {
      void load(true, true);
    }, POPUP_REFRESH_SECONDS * 1000);

    return () => window.clearInterval(intervalId);
  }, [load]);

  useEffect(() => {
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.usageSnapshots?.newValue) return;
      applySnapshots(
        changes.usageSnapshots.newValue as Record<
          ProviderId,
          UsageSnapshot | undefined
        >,
      );
      setLoading(false);
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [applySnapshots]);

  const handleConnect = async (
    provider: ProviderId,
    sessionToken: string,
    orgId?: string,
  ) => {
    setError(null);
    setConnecting(true);
    try {
      const response = await sendMessage({
        type: "CONNECT_PROVIDER",
        provider,
        sessionToken,
        orgId,
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      applySnapshots(response.snapshots);
      setConnectingProvider(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setConnecting(false);
    }
  };

  const handleImportCookie = async (provider: ProviderId) => {
    setError(null);
    setConnecting(true);
    try {
      const response = await sendMessage({
        type: "IMPORT_PROVIDER_COOKIE",
        provider,
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      applySnapshots(response.snapshots);
      setConnectingProvider(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import session.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (provider: ProviderId) => {
    try {
      const response = await sendMessage({
        type: "DISCONNECT_PROVIDER",
        provider,
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      applySnapshots(response.snapshots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect.");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Agent Usage</h1>
          <p className="subtitle">
            {lastUpdated
              ? `Auto-refresh · ${formatFetchedAt(lastUpdated)}`
              : "Subscription usage at a glance"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          title="Refresh now"
        >
          {refreshing ? "…" : "↻"}
        </button>
      </header>

      {error && <div className="banner banner-error">{error}</div>}

      <UpdateNotice />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="cards">
          {PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider}
              label={PROVIDER_LABELS[provider]}
              snapshot={snapshots[provider]}
              onConnect={() => setConnectingProvider(provider)}
              onDisconnect={() => void handleDisconnect(provider)}
            />
          ))}
        </div>
      )}

      <AppFooter />

      {connectingProvider && (
        <ConnectPanel
          provider={connectingProvider}
          connecting={connecting}
          onClose={() => !connecting && setConnectingProvider(null)}
          onConnect={handleConnect}
          onImportCookie={() => void handleImportCookie(connectingProvider)}
        />
      )}
    </div>
  );
}
