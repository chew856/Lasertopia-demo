'use client';

import { useActionState } from 'react';

import { Button, FieldStack, TextInput, ValidationMessage } from '@/components/ui';
import { manager } from '@/lib/copy/manager';
import { global } from '@/lib/copy/global';

import { lookupBookingAction, type LookupState } from './actions';

/**
 * The lookup form. The messages are passed in already interpolated, because the venue phone
 * number is a `Setting` row and a client component has no business reading configuration.
 */

const { lookup } = manager;

export interface LookupMessages {
  notFound: string;
  mismatch: string;
  rateLimit: string;
  incomplete: string;
}

export function LookupForm({ messages }: { messages: LookupMessages }) {
  const [state, formAction, pending] = useActionState<LookupState, FormData>(lookupBookingAction, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <FieldStack>
        <TextInput
          id="code"
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          label={lookup.code.label}
          placeholder={lookup.code.placeholder}
          className="font-mono"
        />
        <TextInput
          id="contact"
          name="contact"
          required
          autoComplete="email"
          label={lookup.contact.label}
          helper={lookup.contact.help}
        />
      </FieldStack>

      {state.error ? (
        <ValidationMessage tone="error">{messages[state.error]}</ValidationMessage>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        pending={pending}
        pendingLabel={global.btn.lookUpBooking}
      >
        {global.btn.lookUpBooking}
      </Button>
    </form>
  );
}
