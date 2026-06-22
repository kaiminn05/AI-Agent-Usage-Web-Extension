import type { ProviderId, UsageSnapshot } from "../types/usage";

const USAGE_KEY = "usageSnapshots";
const POLL_ALARM = "usage-poll";

export const POLL_INTERVAL_MINUTES = 5;
export const POPUP_REFRESH_SECONDS = 60;

export async function getUsageSnapshots(): Promise<
  Record<ProviderId, UsageSnapshot | undefined>
> {
  const result = await chrome.storage.local.get(USAGE_KEY);
  return (
    (result[USAGE_KEY] as Record<ProviderId, UsageSnapshot | undefined>) ?? {
      chatgpt: undefined,
      claude: undefined,
      cursor: undefined,
    }
  );
}

export async function saveUsageSnapshot(
  snapshot: UsageSnapshot,
): Promise<void> {
  const snapshots = await getUsageSnapshots();
  snapshots[snapshot.provider] = snapshot;
  await chrome.storage.local.set({ [USAGE_KEY]: snapshots });
}

export async function schedulePolling(): Promise<void> {
  await chrome.alarms.create(POLL_ALARM, {
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
}

export { POLL_ALARM };
