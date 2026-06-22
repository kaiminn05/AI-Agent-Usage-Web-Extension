import type { ProviderConnection } from "../types/usage";

export type ChatGPTAuth = {
  accessToken: string;
  accountId?: string;
};

type ChatGPTSessionResponse = {
  accessToken?: string;
  user?: {
    id?: string;
  };
  error?: string;
};

export function isJwtLike(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && !token.startsWith("sess-");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractAccountIdFromJwt(token: string): string | undefined {
  const payload = decodeJwtPayload(token);
  if (!payload) return undefined;

  const candidates = [
    payload.chatgpt_account_id,
    payload.account_id,
    payload["https://api.openai.com/auth"] &&
      (payload["https://api.openai.com/auth"] as { account_id?: string })
        .account_id,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function normalizeCookieHeader(input: string): string {
  return input.trim().replace(/^Cookie:\s*/i, "");
}

export function looksLikeCookieHeader(input: string): boolean {
  const normalized = normalizeCookieHeader(input);
  return normalized.includes("=") && normalized.includes("session-token");
}

export function buildCookieHeaderFromBareToken(token: string): string {
  const trimmed = token.trim();
  if (looksLikeCookieHeader(trimmed)) {
    return normalizeCookieHeader(trimmed);
  }

  return `__Secure-next-auth.session-token=${trimmed}`;
}

export async function buildChatGPTCookieHeaderFromBrowser(): Promise<
  string | undefined
> {
  const cookies = await chrome.cookies.getAll({ url: "https://chatgpt.com" });

  const sessionCookies = cookies
    .filter((cookie) =>
      cookie.name.startsWith("__Secure-next-auth.session-token"),
    )
    .sort((a, b) => {
      const suffix = (name: string) =>
        Number(name.match(/\.(\d+)$/)?.[1] ?? 0);
      return suffix(a.name) - suffix(b.name);
    });

  if (sessionCookies.length === 0) {
    return undefined;
  }

  const parts = sessionCookies.map(
    (cookie) => `${cookie.name}=${cookie.value}`,
  );

  const clearance = cookies.find((cookie) => cookie.name === "cf_clearance");
  if (clearance) {
    parts.push(`${clearance.name}=${clearance.value}`);
  }

  return parts.join("; ");
}

export async function exchangeChatGPTSession(
  cookieHeader: string,
): Promise<ChatGPTAuth> {
  const response = await fetch("https://chatgpt.com/api/auth/session", {
    headers: {
      Accept: "application/json",
      Cookie: normalizeCookieHeader(cookieHeader),
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Session expired — reconnect Codex.");
  }

  if (!response.ok) {
    throw new Error(`Codex session error (${response.status})`);
  }

  const session = (await response.json()) as ChatGPTSessionResponse;
  if (!session.accessToken) {
    throw new Error(
      "Could not get Codex access token. Log in at chatgpt.com, then use Import from browser session.",
    );
  }

  const accountId =
    session.user?.id ?? extractAccountIdFromJwt(session.accessToken);

  return {
    accessToken: session.accessToken,
    accountId,
  };
}

export async function resolveChatGPTAuth(
  connection: ProviderConnection,
): Promise<ChatGPTAuth> {
  const token = connection.sessionToken?.trim();
  if (!token) {
    throw new Error("Not connected");
  }

  if (isJwtLike(token)) {
    return {
      accessToken: token,
      accountId: connection.accountId ?? extractAccountIdFromJwt(token),
    };
  }

  const cookieHeader =
    connection.cookieHeader ??
    (looksLikeCookieHeader(token) || token.includes("session-token")
      ? normalizeCookieHeader(
          looksLikeCookieHeader(token)
            ? token
            : buildCookieHeaderFromBareToken(token),
        )
      : buildCookieHeaderFromBareToken(token));

  return exchangeChatGPTSession(cookieHeader);
}

export async function connectChatGPTFromBrowser(): Promise<ProviderConnection> {
  const cookieHeader = await buildChatGPTCookieHeaderFromBrowser();
  if (!cookieHeader) {
    throw new Error(
      "No Codex session found. Log in at chatgpt.com in this browser first.",
    );
  }

  const auth = await exchangeChatGPTSession(cookieHeader);

  return {
    provider: "chatgpt",
    sessionToken: auth.accessToken,
    accountId: auth.accountId,
    cookieHeader,
    connectedAt: new Date().toISOString(),
    label: "From browser session",
  };
}

export async function connectChatGPTFromInput(
  input: string,
): Promise<ProviderConnection> {
  const trimmed = input.trim();

  if (isJwtLike(trimmed)) {
    return {
      provider: "chatgpt",
      sessionToken: trimmed,
      accountId: extractAccountIdFromJwt(trimmed),
      connectedAt: new Date().toISOString(),
    };
  }

  const cookieHeader = looksLikeCookieHeader(trimmed)
    ? normalizeCookieHeader(trimmed)
    : buildCookieHeaderFromBareToken(trimmed);

  const auth = await exchangeChatGPTSession(cookieHeader);

  return {
    provider: "chatgpt",
    sessionToken: auth.accessToken,
    accountId: auth.accountId,
    cookieHeader,
    connectedAt: new Date().toISOString(),
  };
}
