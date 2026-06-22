import { chatgptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { cursorAdapter } from "./cursor";
import type { ProviderAdapter } from "./types";
import type { ProviderId } from "../types/usage";

const adapters: Record<ProviderId, ProviderAdapter> = {
  chatgpt: chatgptAdapter,
  claude: claudeAdapter,
  cursor: cursorAdapter,
};

export function getAdapter(provider: ProviderId): ProviderAdapter {
  return adapters[provider];
}

export function getAllAdapters(): ProviderAdapter[] {
  return Object.values(adapters);
}
