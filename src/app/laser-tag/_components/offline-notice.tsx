"use client";

import { useEffect, useState } from "react";

import { ValidationMessage } from "@/components/ui";
import { laserTag } from "@/lib/copy";

/**
 * `OFFLINE` — STRATEGY §3.1 lists it as a designed state on G1 and G2, not as a browser
 * problem to ignore.
 *
 * The initial value is `true` deliberately: the server has no `navigator`, and rendering
 * "you're offline" for one frame on a perfectly good connection would be worse than the
 * reverse. The real value lands on the first effect.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

/**
 * The banner itself. `err.offline.title` and `err.offline.body` say what happened and that
 * nothing is lost; there is no action, because the only recovery is a connection and the
 * flow resumes by itself when one arrives.
 */
export function OfflineNotice({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="border border-rule border-l-[3px] border-l-state-filling bg-raised p-4">
      <p className="font-display text-button uppercase text-state-filling">
        {laserTag.err.offline.title}
      </p>
      <p className="mt-2 max-w-[56ch] text-body-sm text-text-2">{laserTag.err.offline.body}</p>
    </div>
  );
}

/** The dimmed-grid variant, COPY.md `err.offline.grid`. */
export function OfflineGridNotice({ message }: { message: string }) {
  return <ValidationMessage tone="warning">{message}</ValidationMessage>;
}
