'use client';

/**
 * Global header / nav. Shows the app name (→ overview), and — once signed in —
 * a "Meine Fahrten" link and a logout button. Signed-out visitors get a login
 * link. Rendered from the root layout inside <AuthProvider>.
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

// A single link in the second-row nav: full-width tab, evenly spaced, with a
// bottom-border indicator for the active route (matches the ANGEBOTE/GESUCHE
// tab style on the overview).
function NavTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        'flex-1 border-b-2 px-2 py-2.5 text-center text-sm transition ' +
        (active
          ? 'border-neutral-900 font-medium text-neutral-900'
          : 'border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900')
      }
    >
      {label}
    </Link>
  );
}

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  // On the auth pages themselves, an "Anmelden" link is redundant/confusing.
  const onAuthPage = pathname === '/sign-in' || pathname === '/sign-up';

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto w-full max-w-md">
        {/* Top row: logo alone; "Anmelden" for signed-out visitors. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex items-center"
            aria-label="elb-fahrt.de — zur Startseite"
          >
            <Image
              src="/elb-fahrt-logo.png"
              alt="elb-fahrt.de"
              width={976}
              height={308}
              priority
              className="h-[37px] w-auto"
            />
          </Link>

          {!isLoading && !isAuthenticated && !onAuthPage && (
            <Link
              href="/sign-in"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
            >
              Anmelden
            </Link>
          )}
        </div>

        {/* Second row: primary nav, evenly spaced. Only when signed in. */}
        {!isLoading && isAuthenticated && (
          <nav className="flex border-t border-neutral-200">
            <NavTab href="/" label="Übersicht" active={pathname === '/'} />
            <NavTab
              href="/meine-fahrten"
              label="Meine Fahrten"
              active={pathname.startsWith('/meine-fahrten')}
            />
            <NavTab
              href="/mein-profil"
              label="Profil"
              active={pathname.startsWith('/mein-profil')}
            />
          </nav>
        )}
      </div>
    </header>
  );
}
