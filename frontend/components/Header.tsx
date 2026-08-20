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

// Nav items: a light outline box appears on hover (transparent border by
// default so nothing shifts). Gives users a clear "these are clickable" cue.
const navItem =
  'rounded-md border border-transparent px-2.5 py-1 font-medium text-neutral-700 ' +
  'transition hover:border-[#9aa6a0] hover:bg-neutral-50 hover:text-neutral-900';

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  // On the auth pages themselves, an "Anmelden" link is redundant/confusing.
  const onAuthPage = pathname === '/sign-in' || pathname === '/sign-up';

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 p-4">
        <Link href="/" className="flex items-center" aria-label="elb-fahrt.de — zur Startseite">
          <Image
            src="/elb-fahrt-logo.png"
            alt="elb-fahrt.de"
            width={976}
            height={308}
            priority
            className="h-[37px] w-auto"
          />
        </Link>

        {!isLoading && (
          <nav className="flex flex-wrap items-center justify-end gap-1.5 text-sm">
            {isAuthenticated ? (
              <>
                <Link href="/" className={navItem}>
                  Übersicht
                </Link>
                <Link href="/meine-fahrten" className={navItem}>
                  Meine Fahrten
                </Link>
                <Link href="/mein-profil" className={navItem}>
                  Profil
                </Link>
              </>
            ) : onAuthPage ? null : (
              <Link href="/sign-in" className={navItem}>
                Anmelden
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
