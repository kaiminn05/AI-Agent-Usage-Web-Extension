import type { UsageSnapshot, UsageWindow } from "../../types/usage";
import {
  getManageButtonLabel,
  openManagePlan,
} from "../../constants/provider-urls";
import { formatFetchedAt, formatLimitReset, formatPlanRenewal } from "../../utils/datetime";
import { formatUsageDisplay } from "../../utils/percent";

type ProviderCardProps = {
  label: string;
  snapshot?: UsageSnapshot;
  onConnect: () => void;
  onDisconnect: () => void;
};

function barClass(percent: number): string {
  if (percent >= 90) return "bar-fill critical";
  if (percent >= 75) return "bar-fill warn";
  return "bar-fill";
}

function statusClass(status: UsageSnapshot["status"]): string {
  if (status === "ok") return "status-pill status-ok";
  if (status === "disconnected") return "status-pill status-disconnected";
  return "status-pill status-error";
}

function UsageWindowRow({ window }: { window: UsageWindow }) {
  const usedPercent = Math.max(0, Math.min(100, Math.round(window.usedPercent)));
  const resetText = formatLimitReset(window.resetsAt, {
    includeTime: window.showResetTime,
  });

  return (
    <div className="window">
      <div className="window-label">
        <span>{window.label}</span>
        <span className="usage-value">{formatUsageDisplay(usedPercent)}</span>
      </div>
      <div className="bar-track">
        <div
          className={barClass(usedPercent)}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      {resetText && (
        <div className="card-meta" style={{ marginTop: 4 }}>
          Limit resets {resetText}
        </div>
      )}
    </div>
  );
}

export function ProviderCard({
  label,
  snapshot,
  onConnect,
  onDisconnect,
}: ProviderCardProps) {
  const status = snapshot?.status ?? "disconnected";
  const needsReconnect =
    status === "expired" || status === "error" || status === "rate_limited";
  const sections =
    snapshot?.sections && snapshot.sections.length > 0
      ? snapshot.sections
      : snapshot?.windows.length
        ? [{ title: "Usage", windows: snapshot.windows }]
        : [];

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{label}</div>
          {snapshot?.planType && (
            <div className="card-meta">{snapshot.planType}</div>
          )}
        </div>
        <span className={statusClass(status)}>{status}</span>
      </div>

      {status === "disconnected" && (
        <button type="button" className="btn btn-primary" onClick={onConnect}>
          Connect
        </button>
      )}

      {needsReconnect && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConnect}
          style={{ marginBottom: 8 }}
        >
          Reconnect
        </button>
      )}

      {snapshot?.errorMessage && status !== "disconnected" && (
        <p className="card-meta">{snapshot.errorMessage}</p>
      )}

      {snapshot?.summary && <p className="card-meta">{snapshot.summary}</p>}

      {sections.map((section) => (
        <div className="usage-section" key={section.title}>
          <div className="section-title">{section.title}</div>
          {section.windows.map((window) => (
            <UsageWindowRow key={`${section.title}-${window.label}`} window={window} />
          ))}
        </div>
      ))}

      {snapshot?.renewalDate && formatPlanRenewal(snapshot.renewalDate) && (
        <div className="card-meta" style={{ marginTop: 8 }}>
          Plan renews {formatPlanRenewal(snapshot.renewalDate)}
        </div>
      )}

      {snapshot?.fetchedAt && status === "ok" && (
        <div className="card-meta" style={{ marginTop: 6, fontSize: 10 }}>
          {formatFetchedAt(snapshot.fetchedAt)}
        </div>
      )}

      {status !== "disconnected" && snapshot && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => openManagePlan(snapshot.provider)}
          style={{ marginTop: 8, width: "100%" }}
        >
          {getManageButtonLabel(snapshot.planType)}
        </button>
      )}

      {status !== "disconnected" && (
        <button
          type="button"
          className="btn btn-danger"
          onClick={onDisconnect}
          style={{ marginTop: 8 }}
        >
          Disconnect
        </button>
      )}
    </article>
  );
}
