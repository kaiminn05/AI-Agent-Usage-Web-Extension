import type { ProviderConnection, UsageSnapshot } from "../types/usage";
import type { ProviderAdapter } from "./types";
import { parseExpiry } from "../utils/datetime";
import {
  connectChatGPTFromBrowser,
  connectChatGPTFromInput,
  exchangeChatGPTSession,
  resolveChatGPTAuth,
  type ChatGPTAuth,
} from "./chatgpt-auth";

export { connectChatGPTFromBrowser, connectChatGPTFromInput };

type RateLimitWindow = {
  used_percent?: number;
  reset_at?: number;
  reset_after_seconds?: number;
  limit_window_seconds?: number;
};

type ChatGPTWhamUsage = {
  plan_type?: string;
  rate_limit?: {
    primary_window?: RateLimitWindow;
    secondary_window?: RateLimitWindow;
  };
  credits?: {
    has_credits?: boolean;
    balance?: string;
  };
};

type ChatGPTAccountCheckV4 = {
  accounts?: {
    default?: {
      entitlement?: {
        expires_at?: string | number;
      };
    };
  };
};

type ChatGPTAccountCheckLegacy = {
  account_plan?: {
    subscription_expires_at_timestamp?: number;
  };
};

function shouldShowResetTime(seconds?: number, label?: string): boolean {
  if (label === "5h" || label?.includes("hour")) return true;
  if (!seconds) return false;
  return seconds < 86_400;
}

function resolveResetAt(window: RateLimitWindow): string | undefined {
  if (window.reset_at != null) {
    return new Date(window.reset_at * 1000).toISOString();
  }

  if (window.reset_after_seconds != null) {
    return new Date(
      Date.now() + window.reset_after_seconds * 1000,
    ).toISOString();
  }

  return undefined;
}

function buildWindow(
  label: string,
  bucket?: RateLimitWindow,
): UsageSnapshot["windows"][number] | undefined {
  if (!bucket || bucket.used_percent == null) return undefined;

  return {
    label,
    usedPercent: Math.round(bucket.used_percent),
    resetsAt: resolveResetAt(bucket),
    showResetTime: shouldShowResetTime(bucket.limit_window_seconds, label),
  };
}

function buildCodexWindows(usage: ChatGPTWhamUsage): UsageSnapshot["windows"] {
  const windows: UsageSnapshot["windows"] = [];

  const fiveHour = buildWindow("5h", usage.rate_limit?.primary_window);
  const weekly = buildWindow("Weekly", usage.rate_limit?.secondary_window);

  if (fiveHour) windows.push(fiveHour);
  if (weekly) windows.push(weekly);

  return windows;
}

async function fetchUsageWithAuth(auth: ChatGPTAuth): Promise<ChatGPTWhamUsage> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${auth.accessToken}`,
  };

  if (auth.accountId) {
    headers["ChatGPT-Account-Id"] = auth.accountId;
  }

  const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Session expired — reconnect Codex.");
  }

  if (response.status === 429) {
    throw new Error("Rate limited — try again shortly.");
  }

  if (!response.ok) {
    throw new Error(`Codex usage error (${response.status})`);
  }

  return (await response.json()) as ChatGPTWhamUsage;
}

async function fetchPlanRenewal(auth: ChatGPTAuth): Promise<string | undefined> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${auth.accessToken}`,
  };

  if (auth.accountId) {
    headers["ChatGPT-Account-Id"] = auth.accountId;
  }

  try {
    const v4Response = await fetch(
      "https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27",
      { headers },
    );

    if (v4Response.ok) {
      const data = (await v4Response.json()) as ChatGPTAccountCheckV4;
      const expiresAt = parseExpiry(
        data.accounts?.default?.entitlement?.expires_at,
      );
      if (expiresAt) return expiresAt;
    }
  } catch {
    // fall through to legacy endpoint
  }

  try {
    const legacyResponse = await fetch(
      "https://chatgpt.com/backend-api/accounts/check",
      { headers },
    );

    if (legacyResponse.ok) {
      const data = (await legacyResponse.json()) as ChatGPTAccountCheckLegacy;
      return parseExpiry(
        data.account_plan?.subscription_expires_at_timestamp,
      );
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export const chatgptAdapter: ProviderAdapter = {
  id: "chatgpt",

  async fetchUsage(connection: ProviderConnection): Promise<UsageSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (!connection.sessionToken?.trim()) {
      return {
        provider: "chatgpt",
        windows: [],
        fetchedAt,
        status: "disconnected",
        errorMessage: "Not connected",
      };
    }

    try {
      let auth = await resolveChatGPTAuth(connection);
      let usage: ChatGPTWhamUsage;

      try {
        usage = await fetchUsageWithAuth(auth);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("expired") && connection.cookieHeader) {
          auth = await exchangeChatGPTSession(connection.cookieHeader);
          usage = await fetchUsageWithAuth(auth);
        } else {
          throw error;
        }
      }

      const windows = buildCodexWindows(usage);
      const renewalDate = await fetchPlanRenewal(auth);

      let summary: string | undefined;
      if (usage.credits?.has_credits && usage.credits.balance) {
        summary = `Credits balance: $${usage.credits.balance}`;
      }

      return {
        provider: "chatgpt",
        planType: usage.plan_type,
        windows,
        renewalDate,
        summary,
        fetchedAt,
        status: "ok",
        errorMessage: windows.length
          ? undefined
          : "Connected — no Codex usage windows returned for this plan.",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch Codex usage";

      return {
        provider: "chatgpt",
        windows: [],
        fetchedAt,
        status: message.includes("Rate limited")
          ? "rate_limited"
          : message.includes("expired")
            ? "expired"
            : "error",
        errorMessage: message,
      };
    }
  },
};
