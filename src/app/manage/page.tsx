import { redirect } from 'next/navigation';

/**
 * STRATEGY §2.2: `/manage` is a redirect, not a screen. The board is the landing route, the
 * default tab and the place every action returns to — there is no manager home page to get
 * lost on.
 */
export default function ManageIndexPage() {
  redirect('/manage/schedule');
}
