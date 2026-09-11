import { useLayoutEffect, useRef, type ReactNode } from "react";

// Keep short histories next to the composer without reversing message order.
export function SlackHistory({
  children,
  firstMessage,
}: {
  children: ReactNode;
  firstMessage?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const previous = useRef({ first: firstMessage, height: 0 });
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (pinned.current) el.scrollTop = el.scrollHeight;
    else if (
      previous.current.first !== firstMessage &&
      previous.current.height
    ) {
      el.scrollTop += el.scrollHeight - previous.current.height;
    }
    previous.current = { first: firstMessage, height: el.scrollHeight };
  });
  useLayoutEffect(() => {
    const el = viewport.current,
      body = content.current;
    if (!el || !body) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
      previous.current.height = el.scrollHeight;
    });
    observer.observe(el);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={viewport}
      aria-label="Conversation history"
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
      onScroll={() => {
        const el = viewport.current;
        if (el)
          pinned.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
    >
      <div className="flex min-h-full flex-col justify-end">
        <div ref={content} className="shrink-0 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
}
