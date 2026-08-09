import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Caption, PageShell, SectionHeader, ValidationMessage } from '@/components/ui';
import { manager } from '@/lib/copy/manager';

import { authConfigError, getSession } from '../_lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: manager.mg.login.title };

/** The board is dynamic per request; nothing under `/manage` may be statically cached. */
export const dynamic = 'force-dynamic';

const { login } = manager.mg;

const REASON_MESSAGE: Record<string, string> = {
  expired: login.expired,
  signedOut: login.signedOut,
};

export default async function ManageLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session) redirect('/manage/schedule');

  const params = await searchParams;
  const reason = typeof params.reason === 'string' ? params.reason : undefined;
  const configProblem = authConfigError();

  return (
    <PageShell as="main" width="flow" className="py-16">
      <SectionHeader level={1} headingTag="h1" title={login.heading} />

      {reason && REASON_MESSAGE[reason] ? (
        <p className="mt-6 text-body-sm text-text-2">{REASON_MESSAGE[reason]}</p>
      ) : null}

      {configProblem ? (
        <div className="mt-8 flex flex-col gap-3">
          <ValidationMessage tone="error">{manager.TODO_COPY.notConfigured}</ValidationMessage>
          {/* The exact variable and the exact command, because whoever reads this is at a
              terminal trying to make the backend work, not a customer. */}
          <pre className="overflow-x-auto border border-rule bg-sunken p-3 font-mono text-mono-xs text-text-2">
            {configProblem}
          </pre>
        </div>
      ) : null}

      <LoginForm disabled={configProblem !== null} />

      <Caption className="mt-10">{manager.mg.error.permission}</Caption>
    </PageShell>
  );
}
