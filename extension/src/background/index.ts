import { getAdapter } from "../adapters";
import { exchangeChatGPTSession } from "../adapters/chatgpt-auth";
import type { MessageResponse, MessageType } from "../messages";
import {
  connectProvider,
  getConnection,
  getConnections,
  importProviderCookie,
  removeConnection,
  saveConnection,
} from "../storage/credentials";
import {
  getUsageSnapshots,
  POLL_ALARM,
  saveUsageSnapshot,
  schedulePolling,
} from "../storage/usage-cache";
import type { ProviderId } from "../types/usage";

const IMPORT_ERRORS: Record<ProviderId, string> = {
  cursor: "No Cursor session found. Log in at cursor.com first, then try again.",
  chatgpt:
    "No Codex session found. Log in at chatgpt.com in this browser, then try again.",
  claude: "No Claude session found. Log in at claude.ai first, then try again.",
};

async function refreshChatGPTTokenIfPossible(
  connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>,
): Promise<NonNullable<Awaited<ReturnType<typeof getConnection>>>> {
  if (!connection.cookieHeader) return connection;

  try {
    const auth = await exchangeChatGPTSession(connection.cookieHeader);
    const refreshed = {
      ...connection,
      sessionToken: auth.accessToken,
      accountId: auth.accountId,
    };
    await saveConnection(refreshed);
    return refreshed;
  } catch {
    return connection;
  }
}

async function refreshAllUsage(): Promise<
  Record<ProviderId, import("../types/usage").UsageSnapshot | undefined>
> {
  const connections = await getConnections();

  for (const provider of Object.keys(connections) as ProviderId[]) {
    let connection = connections[provider];
    if (!connection?.sessionToken) continue;

    if (provider === "chatgpt") {
      connection = await refreshChatGPTTokenIfPossible(connection);
    }

    const snapshot = await getAdapter(provider).fetchUsage(connection);
    await saveUsageSnapshot(snapshot);
  }

  return getUsageSnapshots();
}

async function fetchAndSave(provider: ProviderId): Promise<void> {
  let connection = await getConnection(provider);
  if (!connection) return;

  if (provider === "chatgpt") {
    connection = await refreshChatGPTTokenIfPossible(connection);
  }

  const snapshot = await getAdapter(provider).fetchUsage(connection);
  await saveUsageSnapshot(snapshot);
}

async function handleMessage(message: MessageType): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case "GET_USAGE": {
        return { ok: true, snapshots: await getUsageSnapshots() };
      }

      case "REFRESH_USAGE": {
        return { ok: true, snapshots: await refreshAllUsage() };
      }

      case "CONNECT_PROVIDER": {
        const connection = await connectProvider(
          message.provider,
          message.sessionToken,
          message.orgId,
        );
        await saveConnection(connection);
        await fetchAndSave(message.provider);
        return { ok: true, snapshots: await getUsageSnapshots() };
      }

      case "DISCONNECT_PROVIDER": {
        await removeConnection(message.provider);
        const snapshots = await getUsageSnapshots();
        snapshots[message.provider] = undefined;
        await chrome.storage.local.set({ usageSnapshots: snapshots });
        return { ok: true, snapshots };
      }

      case "IMPORT_PROVIDER_COOKIE": {
        try {
          const connection = await importProviderCookie(message.provider);
          if (!connection) {
            return { ok: false, error: IMPORT_ERRORS[message.provider] };
          }

          await saveConnection(connection);
          await fetchAndSave(message.provider);
          return { ok: true, snapshots: await getUsageSnapshots() };
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : IMPORT_ERRORS[message.provider],
          };
        }
      }

      default:
        return { ok: false, error: "Unknown message type" };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    void refreshAllUsage();
  }
});

void schedulePolling();
