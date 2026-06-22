import type { ProviderConnection, UsageSnapshot } from "../types/usage";
import type { ProviderAdapter } from "./types";
import { formatBillingDate, parsePercent } from "../utils/percent";

type CursorPlanBucket = {
  enabled?: boolean;
  used?: number;
  limit?: number;
  remaining?: number;
  autoPercentUsed?: number;
  apiPercentUsed?: number;
  totalPercentUsed?: number;
  breakdown?: {
    included?: number;
    bonus?: number;
    total?: number;
  };
};

type CursorUsageSummary = {
  billingCycleStart?: string;
  billingCycleEnd?: string;
  membershipType?: string;
  planUsage?: CursorPlanBucket & {
    totalSpend?: number;
    includedSpend?: number;
    limit?: number;
    remaining?: number;
  };
  individualUsage?: {
    plan?: CursorPlanBucket;
    onDemand?: {
      enabled?: boolean;
      used?: number;
      limit?: number | null;
      remaining?: number | null;
    };
  };
};

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function percentFromSpend(used: number, limit: number): number | undefined {
  if (limit <= 0) return undefined;
  return Math.min(100, Math.round((used / limit) * 100));
}

async function cursorFetch<T>(
  path: string,
  sessionToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://cursor.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Cookie: `WorkosCursorSessionToken=${sessionToken}`,
      ...(init?.method === "POST"
        ? {
            "Content-Type": "application/json",
            Origin: "https://cursor.com",
          }
        : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Session expired — reconnect Cursor in settings.");
  }

  if (!response.ok) {
    throw new Error(`Cursor API error (${response.status})`);
  }

  return (await response.json()) as T;
}

function buildWindows(
  plan: CursorPlanBucket | undefined,
  billingCycleEnd?: string,
): UsageSnapshot["windows"] {
  if (!plan) return [];

  const resetsAt = formatBillingDate(billingCycleEnd);
  const windows: UsageSnapshot["windows"] = [];

  const total = parsePercent(plan.totalPercentUsed);
  const auto = parsePercent(plan.autoPercentUsed);
  const api = parsePercent(plan.apiPercentUsed);

  if (total != null) {
    windows.push({ label: "Total", usedPercent: total, resetsAt });
  }
  if (auto != null) {
    windows.push({ label: "Auto + Composer", usedPercent: auto, resetsAt });
  }
  if (api != null) {
    windows.push({ label: "API", usedPercent: api, resetsAt });
  }

  // Fallback only when server percentages are absent and limit is meaningful
  if (windows.length === 0 && plan.limit != null && plan.limit > 0) {
    const used = plan.used ?? 0;
    const fallback = percentFromSpend(used, plan.limit);
    if (fallback != null) {
      windows.push({ label: "Total", usedPercent: fallback, resetsAt });
    }
  }

  return windows;
}

function buildSummary(plan: CursorPlanBucket | undefined): string | undefined {
  if (!plan) return undefined;

  const limit = plan.limit ?? 0;
  const used = plan.used ?? 0;

  if (limit > 0) {
    return `${formatDollars(used)} / ${formatDollars(limit)} included API budget`;
  }

  return undefined;
}

export const cursorAdapter: ProviderAdapter = {
  id: "cursor",

  async fetchUsage(connection: ProviderConnection): Promise<UsageSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (!connection.sessionToken?.trim()) {
      return {
        provider: "cursor",
        windows: [],
        fetchedAt,
        status: "disconnected",
        errorMessage: "Not connected",
      };
    }

    try {
      const summary = await cursorFetch<CursorUsageSummary>(
        "/api/usage-summary",
        connection.sessionToken.trim(),
      );

      const plan =
        summary.individualUsage?.plan ??
        (summary.planUsage
          ? {
              ...summary.planUsage,
              used: summary.planUsage.includedSpend ?? summary.planUsage.used,
              limit: summary.planUsage.limit,
              autoPercentUsed: summary.planUsage.autoPercentUsed,
              apiPercentUsed: summary.planUsage.apiPercentUsed,
              totalPercentUsed: summary.planUsage.totalPercentUsed,
            }
          : undefined);

      const billingEnd =
        summary.billingCycleEnd ?? summary.billingCycleStart ?? undefined;

      const windows = buildWindows(plan, billingEnd);
      const onDemand = summary.individualUsage?.onDemand;

      if (onDemand?.enabled && onDemand.limit != null && onDemand.limit > 0) {
        windows.push({
          label: "On-demand",
          usedPercent: percentFromSpend(onDemand.used ?? 0, onDemand.limit) ?? 0,
          resetsAt: formatBillingDate(billingEnd),
        });
      }

      return {
        provider: "cursor",
        planType: summary.membershipType,
        sections: windows.length ? [{ title: "Included usage", windows }] : [],
        windows,
        renewalDate: formatBillingDate(billingEnd),
        summary: buildSummary(plan),
        fetchedAt,
        status: windows.length ? "ok" : "ok",
        errorMessage: windows.length
          ? undefined
          : "Connected — usage percentages not returned for this plan.",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch Cursor usage";

      return {
        provider: "cursor",
        windows: [],
        fetchedAt,
        status: message.includes("expired") ? "expired" : "error",
        errorMessage: message,
      };
    }
  },
};
