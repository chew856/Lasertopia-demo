'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Eyebrow, PageShell, buttonClassName, cx } from '@/components/ui';
import { manager } from '@/lib/copy/manager';

import { logoutAction } from '../_lib/actions';

/**
 * The staff chrome — deliberately recessive.
 *
 * STRATEGY §5 ranks navigation last on the board: "leaving the board is not the happy path".
 * So the nav is one 44px strip of small caps, the board is first and marked `aria-current`,
 * and the four buried-tier screens sit behind a visible but quiet `Setup` group rather than a
 * menu that has to be opened.
 *
 * Client, only because `aria-current` needs the pathname. Everything it renders is static.
 */

const { mg, TODO_COPY } = manager;

const SHIFT_LINKS = [
  { href: '/manage/schedule', label: mg.board.title },
  { href: '/manage/bookings', label: mg.bookings.title },
  { href: '/manage/activity', label: mg.activity.title },
] as const;

const SETUP_LINKS = [
  { href: '/manage/rooms', label: mg.rooms.title },
  { href: '/manage/slots', label: mg.slots.title },
  { href: '/manage/closures', label: mg.closures.title },
  { href: '/manage/settings', label: mg.settings.title },
] as const;

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cx(
        'flex h-11 items-center border-b-2 px-2 font-display text-tag uppercase',
        'transition-colors duration-[var(--duration-fast)] ease-out',
        current ? 'border-b-accent text-text' : 'border-b-transparent text-text-2 hover:text-text',
      )}
    >
      {label}
    </Link>
  );
}

export function ManageChrome({ staffName, children }: { staffName: string; children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isCurrent = (href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule">
        <PageShell width="board" className="flex flex-wrap items-center gap-x-6 gap-y-1 py-1">
          <nav aria-label={mg.board.title} className="flex items-center gap-1">
            {SHIFT_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} current={isCurrent(link.href)} />
            ))}
          </nav>

          <nav aria-label={TODO_COPY.setupGroup} className="flex items-center gap-1">
            <Eyebrow as="span" className="text-text-3">
              {TODO_COPY.setupGroup}
            </Eyebrow>
            {SETUP_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} current={isCurrent(link.href)} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-mono-xs text-text-3">{staffName}</span>
            <form action={logoutAction}>
              <button type="submit" className={buttonClassName('ghost')}>
                {TODO_COPY.signOut}
              </button>
            </form>
          </div>
        </PageShell>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
