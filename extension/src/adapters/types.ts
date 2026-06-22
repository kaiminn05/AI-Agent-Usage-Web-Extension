import type { ProviderConnection, UsageSnapshot } from "../types/usage";

export type ProviderAdapter = {
  id: ProviderConnection["provider"];
  fetchUsage: (connection: ProviderConnection) => Promise<UsageSnapshot>;
};
