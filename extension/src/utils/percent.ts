/** Normalize API percent fields (0–100). Returns undefined if missing or non-finite. */
export function parsePercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Claude utilization may be 0–1 or 0–100 depending on endpoint version. */
export function normalizeUtilization(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const percent = value > 0 && value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function formatBillingDate(value?: string): string | undefined {
  if (!value) return undefined;

  const asNumber = Number(value);
  const date = Number.isFinite(asNumber)
    ? new Date(asNumber)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Unified usage label: `30/100% (70% left)` */
export function formatUsageDisplay(usedPercent: number): string {
  const used = Math.max(0, Math.min(100, Math.round(usedPercent)));
  const left = 100 - used;
  return `${used}/100% (${left}% left)`;
}
