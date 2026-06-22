import { useEffect, useState } from "react";
import {
  EXTENSION_VERSION,
  GITHUB_RELEASES_URL,
} from "../../constants/extension-meta";

function normalizeVersion(tag: string): string {
  return tag.replace(/^v/i, "").trim();
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = normalizeVersion(latest).split(".").map(Number);
  const currentParts = normalizeVersion(current).split(".").map(Number);
  const length = Math.max(latestParts.length, currentParts.length);

  for (let i = 0; i < length; i += 1) {
    const a = latestParts[i] ?? 0;
    const b = currentParts[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }

  return false;
}

export function UpdateNotice() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/kaiminn05/AI-Agent-Usage-Web-Extension/releases/latest",
          {
            signal: controller.signal,
            headers: { Accept: "application/vnd.github+json" },
          },
        );

        if (!response.ok) return;

        const data = (await response.json()) as { tag_name?: string };
        const tag = data.tag_name;
        if (!tag) return;

        const latest = normalizeVersion(tag);
        if (isNewerVersion(latest, EXTENSION_VERSION)) {
          setLatestVersion(latest);
        }
      } catch {
        // Offline or rate-limited — skip quietly
      }
    })();

    return () => controller.abort();
  }, []);

  if (!latestVersion) return null;

  return (
    <div className="banner banner-update">
      <span>
        v{latestVersion} is available — adapters and fixes ship with extension
        updates.
      </span>{" "}
      <a
        className="banner-update-link"
        href={GITHUB_RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Get update
      </a>
    </div>
  );
}
