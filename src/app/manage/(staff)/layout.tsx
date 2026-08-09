import type { ReactNode } from 'react';

import { ManageChrome } from '../_components/manage-chrome';
import { requireStaff } from '../_lib/auth';

/**
 * The authentication boundary for every staff screen.
 *
 * `/manage/login` sits outside this route group on purpose — it is the one `/manage/*` route
 * that must render to a signed-out visitor. Everything inside redirects before it renders.
 *
 * This layout is **not** the only guard. A Server Action is reachable by POST without this
 * layout ever running, so every mutation in `_lib/actions.ts` calls `requireStaff()` itself.
 * Two guards, because the layout protects the screens and the actions protect the data.
 */

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff();
  return <ManageChrome staffName={session.name}>{children}</ManageChrome>;
}
