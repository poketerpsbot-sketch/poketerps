"use client";

import { useEffect, useRef } from "react";

export function ViewTracker({ entryId }: { entryId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const controller = new AbortController();
    void fetch(`/api/entries/${encodeURIComponent(entryId)}/views`, {
      method: "POST",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [entryId]);

  return null;
}
