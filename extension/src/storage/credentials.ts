import type { ProviderConnection, ProviderId } from "../types/usage";
import {
  connectChatGPTFromBrowser,
  connectChatGPTFromInput,
} from "../adapters/chatgpt-auth";

const CONNECTIONS_KEY = "connections";

export async function getConnections(): Promise<
  Record<ProviderId, ProviderConnection | undefined>
> {
  const result = await chrome.storage.local.get(CONNECTIONS_KEY);
  return (
    (result[CONNECTIONS_KEY] as Record<
      ProviderId,
      ProviderConnection | undefined
    >) ?? {
      chatgpt: undefined,
      claude: undefined,
      cursor: undefined,
    }
  );
}

export async function getConnection(
  provider: ProviderId,
): Promise<ProviderConnection | undefined> {
  const connections = await getConnections();
  return connections[provider];
}

export async function saveConnection(
  connection: ProviderConnection,
): Promise<void> {
  const connections = await getConnections();
  connections[connection.provider] = connection;
  await chrome.storage.local.set({ [CONNECTIONS_KEY]: connections });
}

export async function removeConnection(provider: ProviderId): Promise<void> {
  const connections = await getConnections();
  connections[provider] = undefined;
  await chrome.storage.local.set({ [CONNECTIONS_KEY]: connections });
}

export async function tryReadCursorCookie(): Promise<string | undefined> {
  const cookie = await chrome.cookies.get({
    url: "https://cursor.com",
    name: "WorkosCursorSessionToken",
  });
  return cookie?.value;
}

export async function tryReadClaudeSessionCookie(): Promise<
  string | undefined
> {
  const cookie = await chrome.cookies.get({
    url: "https://claude.ai",
    name: "sessionKey",
  });
  return cookie?.value;
}

export async function tryReadClaudeOrgCookie(): Promise<string | undefined> {
  const cookie = await chrome.cookies.get({
    url: "https://claude.ai",
    name: "lastActiveOrg",
  });
  return cookie?.value;
}

async function importCursorConnection(): Promise<ProviderConnection | null> {
  const sessionToken = await tryReadCursorCookie();
  if (!sessionToken) return null;

  return {
    provider: "cursor",
    sessionToken,
    connectedAt: new Date().toISOString(),
    label: "From browser session",
  };
}

async function importClaudeConnection(): Promise<ProviderConnection | null> {
  const sessionToken = await tryReadClaudeSessionCookie();
  if (!sessionToken) return null;

  return {
    provider: "claude",
    sessionToken,
    orgId: await tryReadClaudeOrgCookie(),
    connectedAt: new Date().toISOString(),
    label: "From browser session",
  };
}

export async function importProviderCookie(
  provider: ProviderId,
): Promise<ProviderConnection | null> {
  switch (provider) {
    case "cursor":
      return await importCursorConnection();
    case "chatgpt":
      return await connectChatGPTFromBrowser();
    case "claude":
      return await importClaudeConnection();
  }
}

export async function connectProvider(
  provider: ProviderId,
  sessionToken: string,
  orgId?: string,
): Promise<ProviderConnection> {
  switch (provider) {
    case "chatgpt":
      return connectChatGPTFromInput(sessionToken);
    case "claude":
      return {
        provider: "claude",
        sessionToken: sessionToken.trim(),
        orgId: orgId?.trim() || (await tryReadClaudeOrgCookie()),
        connectedAt: new Date().toISOString(),
      };
    case "cursor":
      return {
        provider: "cursor",
        sessionToken: sessionToken.trim(),
        connectedAt: new Date().toISOString(),
      };
  }
}
