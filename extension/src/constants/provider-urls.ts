import type { ProviderId } from "../types/usage";

export const PROVIDER_MANAGE_URLS: Record<ProviderId, string> = {
  chatgpt: "https://chatgpt.com/#settings/Account",
  claude: "https://claude.ai/settings/billing",
  cursor: "https://cursor.com/dashboard?tab=billing",
};

export function getManageButtonLabel(planType?: string): string {
  const normalized = planType?.toLowerCase() ?? "";
  if (!normalized || normalized === "free" || normalized === "hobby") {
    return "Upgrade plan";
  }
  return "Manage plan";
}

export function openManagePlan(provider: ProviderId): void {
  window.open(PROVIDER_MANAGE_URLS[provider], "_blank", "noopener,noreferrer");
}
