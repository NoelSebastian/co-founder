import { useEffect, useState, type SetStateAction } from "react";
import type { SlackMessage } from "./api";
function restore(key: string): SlackMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "[]").map(
      (m: SlackMessage) =>
        m.localStatus === "pending"
          ? {
              ...m,
              localStatus: "uncertain",
              localError:
                "Confirmation interrupted. Check Slack before retrying.",
            }
          : m,
    );
  } catch {
    return [];
  }
}
// Preserve failed/uncertain drafts across navigation without automatically resending.
export function useSlackOutbox(
  key: string,
): [SlackMessage[], (next: SetStateAction<SlackMessage[]>) => void] {
  const [state, setState] = useState(() => ({ key, messages: restore(key) }));
  if (state.key !== key) setState({ key, messages: restore(key) });
  useEffect(() => {
    try {
      sessionStorage.setItem(state.key, JSON.stringify(state.messages));
    } catch {}
  }, [state]);
  return [
    state.messages,
    (next) =>
      setState((old) =>
        old.key !== key
          ? old
          : {
              key,
              messages: typeof next === "function" ? next(old.messages) : next,
            },
      ),
  ];
}
