import Link from "next/link";

import { FlowSection, PageShell, buttonClassName } from "@/components/ui";
import { global, party } from "@/lib/copy";

import { CallLink, RejectionPanel } from "./_components/flow-chrome";

/**
 * A dead link inside the party flow — an expired draft id, a mistyped booking code.
 *
 * A bare 404 would break STRATEGY §0's failure contract, so this states what happened and gives
 * the two things a parent can actually do next.
 */
export default function PartyNotFound() {
  return (
    <PageShell as="main" width="flow" className="py-8 md:py-12">
      <FlowSection>
        <RejectionPanel
          title={party.err.notFound.title}
          body={party.err.notFound.body}
          actions={
            <>
              <Link href="/parties" className={buttonClassName("primary")}>
                {party.err.notFound.action.primary}
              </Link>
              <Link href="/manage-booking" className={buttonClassName("secondary")}>
                {global.btn.lookUpBooking}
              </Link>
              <CallLink variant="ghost" />
            </>
          }
        />
      </FlowSection>
    </PageShell>
  );
}
