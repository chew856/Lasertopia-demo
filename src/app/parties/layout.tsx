import Link from "next/link";
import type { ReactNode } from "react";

import { PageShell } from "@/components/ui";
import { global } from "@/lib/copy";
import { formatPhoneHref } from "@/lib/format";

/**
 * Flow chrome. Deliberately thin: a wordmark back to the router, a tap-to-call, and the
 * standing venue facts in the footer. Everything that carries a decision lives in the page.
 */
export default function PartiesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-rule">
        <PageShell as="div" className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="font-display text-heading uppercase text-text">
            {global.productName}
          </Link>
          <a
            href={formatPhoneHref(global.phone)}
            className="font-mono text-mono-sm tabular-nums text-text-2 hover:text-accent"
          >
            {global.phone}
          </a>
        </PageShell>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-16 border-t border-rule">
        <PageShell as="div" className="grid gap-4 py-8 text-body-sm text-text-2 md:grid-cols-3">
          <p>{global.address}</p>
          <p>{global.timezoneNote}</p>
          <p>
            <a
              href="https://lasertopia.ca"
              className="underline underline-offset-4 hover:text-accent"
            >
              {global.marketingLink}
            </a>
          </p>
        </PageShell>
      </footer>
    </div>
  );
}
