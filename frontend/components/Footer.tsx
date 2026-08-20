import Link from 'next/link';
import { LogoutLink } from './LogoutLink';

/**
 * Global footer — logout (when signed in) + legal links, rendered from the root
 * layout below the page.
 */
export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-6 text-sm text-neutral-600">
        <LogoutLink />
        <nav className="flex items-center gap-4">
          <Link href="/impressum" className="underline hover:no-underline">
            Impressum
          </Link>
          <span className="text-neutral-400" aria-hidden="true">
            ·
          </span>
          <Link href="/datenschutz" className="underline hover:no-underline">
            Datenschutz
          </Link>
          <span className="text-neutral-400" aria-hidden="true">
            ·
          </span>
          <Link href="/mitmachen" className="underline hover:no-underline">
            Mitmachen
          </Link>
        </nav>

        <div className="flex w-full items-center justify-between">
          <span className="text-neutral-500">© 2026 Förderverein Binnenmarsch</span>
          <a
            href="https://github.com/illheim/elbfahrt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Quellcode auf GitHub"
            title="Quellcode auf GitHub"
            className="text-neutral-500 transition hover:text-neutral-900"
          >
            <GitHubMark />
          </a>
        </div>
      </div>
    </footer>
  );
}

/** GitHub "mark" (Octocat) logo. */
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
