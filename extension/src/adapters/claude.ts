import type { ProviderConnection, UsageSnapshot } from "../types/usage";
import type { ProviderAdapter } from "./types";
import { formatBillingDate, normalizeUtilization } from "../utils/percent";

type ClaudeUsageWindow = {
  utilization?: number;
  resets_at?: string;
};

type ClaudeUsageResponse = {
  five_hour?: ClaudeUsageWindow;
  seven_day?: ClaudeUsageWindow;
  seven_day_sonnet?: ClaudeUsageWindow;
  seven_day_opus?: ClaudeUsageWindow;
  seven_day_routines?: ClaudeUsageWindow;
};

type ClaudeOrganization = {
  uuid?: string;
  name?: string;
};

type ClaudeSubscriptionDetails = {
  next_charge_date?: string;
  billing_interval?: string;
};

type ClaudeAccountResponse = {
  memberships?: Array<{
    organization?: { uuid?: string };
  }>;
};

const CLAUDE_HEADERS = {
  Accept: "application/json",
  Referer: "https://claude.ai/settings/usage",
};

async function claudeFetch<T>(
  url: string,
  sessionKey: string,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      ...CLAUDE_HEADERS,
      Cookie: `sessionKey=${sessionKey}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Session expired — reconnect Claude.");
  }

  if (response.status === 429) {
    throw new Error("Rate limited — try again shortly.");
  }

  if (!response.ok) {
    throw new Error(`Claude API error (${response.status})`);
  }

  return (await response.json()) as T;
}

async function resolveOrgId(
  sessionKey: string,
  orgId?: string,
): Promise<string> {
  if (orgId?.trim()) return orgId.trim();

  try {
    const orgs = await claudeFetch<ClaudeOrganization[]>(
      "https://claude.ai/api/organizations",
      sessionKey,
    );
    const first = orgs[0]?.uuid;
    if (first) return first;
  } catch {
    // fall through to account endpoint
  }

  const account = await claudeFetch<ClaudeAccountResponse>(
    "https://claude.ai/api/account",
    sessionKey,
  );

  const fromAccount = account.memberships?.[0]?.organization?.uuid;
  if (!fromAccount) {
    throw new Error("Could not determine Claude organization ID.");
  }

  return fromAccount;
}

function addWindow(
  windows: UsageSnapshot["windows"],
  label: string,
  bucket?: ClaudeUsageWindow,
): void {
  if (!bucket) return;

  const usedPercent = normalizeUtilization(bucket.utilization);
  if (usedPercent == null) return;

  windows.push({
    label,
    usedPercent,
    resetsAt: formatBillingDate(bucket.resets_at),
    showResetTime: label.includes("hour"),
  });
}

export const claudeAdapter: ProviderAdapter = {
  id: "claude",

  async fetchUsage(connection: ProviderConnection): Promise<UsageSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (!connection.sessionToken?.trim()) {
      return {
        provider: "claude",
        windows: [],
        fetchedAt,
        status: "disconnected",
        errorMessage: "Not connected",
      };
    }

    try {
      const sessionKey = connection.sessionToken.trim();
      const orgId = await resolveOrgId(sessionKey, connection.orgId);

      const usage = await claudeFetch<ClaudeUsageResponse>(
        `https://claude.ai/api/organizations/${orgId}/usage`,
        sessionKey,
      );

      const windows: UsageSnapshot["windows"] = [];
      addWindow(windows, "5-hour", usage.five_hour);
      addWindow(windows, "7-day", usage.seven_day);
      addWindow(windows, "7-day (Sonnet)", usage.seven_day_sonnet);
      addWindow(windows, "7-day (Opus)", usage.seven_day_opus);
      addWindow(windows, "Daily Routines", usage.seven_day_routines);

      let renewalDate: string | undefined;
      try {
        const subscription = await claudeFetch<ClaudeSubscriptionDetails>(
          `https://claude.ai/api/organizations/${orgId}/subscription_details`,
          sessionKey,
        );
        renewalDate = formatBillingDate(subscription.next_charge_date);
      } catch {
        // optional endpoint — not all accounts expose it
      }

      return {
        provider: "claude",
        sections: windows.length ? [{ title: "Usage", windows }] : [],
        windows,
        renewalDate,
        fetchedAt,
        status: windows.length ? "ok" : "ok",
        errorMessage: windows.length
          ? undefined
          : "Connected — no usage windows returned.",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch Claude usage";

      const status = message.includes("expired")
        ? "expired"
        : message.includes("Rate limited")
          ? "rate_limited"
          : "error";

      return {
        provider: "claude",
        windows: [],
        fetchedAt,
        status,
        errorMessage: message,
      };
    }
  },
};
