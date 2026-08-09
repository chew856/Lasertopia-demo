import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink, Eyebrow, MonoValue, PageShell, SectionHeader } from "@/components/ui";
import { global, interpolate, laserTag } from "@/lib/copy";
import { formatPhone, formatPhoneHref } from "@/lib/format";

import { loadVenue } from "../laser-tag/_lib/venue";

/**
 * `/closed` — nothing bookable (STRATEGY §2.1, COPY.md §7).
 *
 * Reached when the venue has no bookable inventory anywhere in the browsing window: every
 * date in the horizon is either closed or has no games on it. That is a different fact from
 * "your group of twelve does not fit today", which is `DAY_FULL` and stays inside the flow —
 * this page exists so a full closure reads as a closure and not as a broken booking form.
 *
 * It states the hours and gives the phone number, because the venue is still there even when
 * the website has nothing to sell.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: laserTag.closed.title,
};

export default async function ClosedPage() {
  const { config } = await loadVenue();
  const phone = formatPhone(config.venuePhone);

  return (
    <PageShell as="main" width="flow" className="flex flex-1 flex-col py-12 md:py-16">
      <SectionHeader
        level={1}
        headingTag="h1"
        title={laserTag.closed.heading}
        description={interpolate(laserTag.closed.body, { phone })}
      />

      <div className="mt-10">
        <ButtonLink variant="primary" href={formatPhoneHref(config.venuePhone)}>
          {interpolate(global.phoneCall, { phone })}
        </ButtonLink>
      </div>

      <section className="mt-12 border-t border-rule pt-6">
        <Eyebrow as="h2">{global.hours.heading}</Eyebrow>
        <ul className="mt-4 flex flex-col gap-2">
          {[global.hours.monThu, global.hours.fri, global.hours.sat, global.hours.sun].map(
            (line) => (
              <li key={line}>
                <MonoValue step="sm" className="text-text-2">
                  {line}
                </MonoValue>
              </li>
            ),
          )}
        </ul>
      </section>

      <footer className="mt-auto border-t border-rule pt-6 text-body-sm text-text-2">
        <p>{global.address}</p>
        <p className="mt-2">
          <Link
            href="/"
            className="underline decoration-1 underline-offset-4 hover:text-accent"
          >
            {global.productName}
          </Link>
        </p>
        <p className="mt-2 text-text-3">{global.timezoneNote}</p>
      </footer>
    </PageShell>
  );
}
