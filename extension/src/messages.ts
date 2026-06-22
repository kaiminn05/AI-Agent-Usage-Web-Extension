import type { ProviderId, UsageSnapshot } from "./types/usage";

export type MessageType =
  | { type: "GET_USAGE" }
  | { type: "REFRESH_USAGE" }
  | {
      type: "CONNECT_PROVIDER";
      provider: ProviderId;
      sessionToken: string;
      orgId?: string;
      accountId?: string;
    }
  | { type: "DISCONNECT_PROVIDER"; provider: ProviderId }
  | { type: "IMPORT_PROVIDER_COOKIE"; provider: ProviderId };

export type MessageResponse =
  | { ok: true; snapshots: Record<ProviderId, UsageSnapshot | undefined> }
  | { ok: false; error: string };
