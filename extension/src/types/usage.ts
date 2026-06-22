export type ProviderId = "chatgpt" | "claude" | "cursor";

export type UsageStatus =
  | "ok"
  | "expired"
  | "rate_limited"
  | "error"
  | "disconnected";

export type UsageWindow = {
  label: string;
  usedPercent: number;
  resetsAt?: string;
  /** Show clock time on limit reset (e.g. 5-hour rolling windows). */
  showResetTime?: boolean;
};

export type UsageSection = {
  title: string;
  windows: UsageWindow[];
};

export type UsageSnapshot = {
  provider: ProviderId;
  planType?: string;
  windows: UsageWindow[];
  sections?: UsageSection[];
  renewalDate?: string;
  summary?: string;
  fetchedAt: string;
  status: UsageStatus;
  errorMessage?: string;
};

export type ProviderConnection = {
  provider: ProviderId;
  connectedAt: string;
  sessionToken?: string;
  orgId?: string;
  accountId?: string;
  cookieHeader?: string;
  label?: string;
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  chatgpt: "Codex",
  claude: "Claude",
  cursor: "Cursor",
};
