import {
  AUTHOR,
  EXTENSION_VERSION,
  GITHUB_REPO_URL,
} from "../../constants/extension-meta";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <span>v{EXTENSION_VERSION}</span>
      <span className="app-footer-sep">·</span>
      <a
        className="app-footer-link"
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
      <span className="app-footer-sep">·</span>
      <span>{AUTHOR}</span>
    </footer>
  );
}
