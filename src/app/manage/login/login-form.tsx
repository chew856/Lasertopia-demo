'use client';

import { useActionState } from 'react';

import { Button, FieldStack, TextInput, ValidationMessage } from '@/components/ui';
import { manager } from '@/lib/copy/manager';

import { loginAction, type LoginState } from '../_lib/actions';

/**
 * The only client component on the login screen. The form posts to a Server Action, so it
 * still submits with JavaScript disabled — `useActionState` adds the in-flight state and the
 * error message, it does not own the submission.
 *
 * `mg.login.error` never says which half was wrong, which is why there is one message slot
 * rather than per-field errors.
 */

const { login } = manager.mg;

const MESSAGE: Record<NonNullable<LoginState['error']>, string> = {
  invalid: login.error,
  locked: login.locked,
  server: login.server,
  unconfigured: manager.TODO_COPY.notConfigured,
};

export function LoginForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <FieldStack>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={disabled}
          label={login.email.label}
        />
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={disabled}
          label={login.password.label}
        />
      </FieldStack>

      {state.error ? (
        <ValidationMessage tone="error">{MESSAGE[state.error]}</ValidationMessage>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        disabled={disabled}
        pending={pending}
        pendingLabel={login.cta}
      >
        {login.cta}
      </Button>
    </form>
  );
}
