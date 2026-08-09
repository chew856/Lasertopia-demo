import type { Metadata } from 'next';
import Link from 'next/link';

import { Caption, PageShell, SectionHeader, buttonClassName } from '@/components/ui';
import { interpolate } from '@/lib/copy';
import { global } from '@/lib/copy/global';
import { manager } from '@/lib/copy/manager';
import { prisma } from '@/lib/db/client';
import { formatPhone, formatPhoneHref } from '@/lib/format';

import { LookupForm } from './lookup-form';

/**
 * `/manage-booking` — "Find your booking". COPY.md §6.
 *
 * Public, and the only screen in this surface that is. It exists because identity is
 * `booking code + phone or email`, so a parent who has lost the link still has a way in that
 * is not a phone call — while still being a way that needs both halves.
 */

export const metadata: Metadata = { title: manager.lookup.title };
export const dynamic = 'force-dynamic';

const { lookup, lookupError } = manager;

async function venuePhone(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: 'CFG.venuePhone' } });
  return row?.value ?? global.phone;
}

export default async function ManageBookingPage() {
  const phoneRaw = await venuePhone();
  let phone = phoneRaw;
  let phoneHref = '';
  try {
    phone = formatPhone(phoneRaw);
    phoneHref = formatPhoneHref(phoneRaw);
  } catch {
    phoneHref = '';
  }

  return (
    <PageShell as="main" width="flow" className="py-12 md:py-16">
      <SectionHeader
        level={1}
        headingTag="h1"
        title={lookup.heading}
        description={lookup.sub}
      />

      <LookupForm
        messages={{
          notFound: interpolate(lookupError.notFound.body, { phone }),
          mismatch: interpolate(lookupError.mismatch.body, { phone }),
          rateLimit: interpolate(lookupError.rateLimit.body, { phone }),
          // No §8 key covers "you left one of the two fields empty", because the deck assumes
          // the browser's own `required` catches it. It does, unless scripting is off — so the
          // server still answers, using the field-level wording from §6 rather than inventing a
          // new sentence.
          incomplete: lookup.contact.help,
        }}
      />

      <Caption className="mt-10">{interpolate(lookup.noCode, { phone })}</Caption>

      {phoneHref ? (
        <div className="mt-4">
          <a href={phoneHref} className={buttonClassName('secondary')}>
            {interpolate(global.phoneCall, { phone })}
          </a>
        </div>
      ) : null}

      <p className="mt-10 text-body-sm">
        <Link href="/" className="text-text-2 underline decoration-1 underline-offset-4">
          {global.btn.back}
        </Link>
      </p>
    </PageShell>
  );
}
