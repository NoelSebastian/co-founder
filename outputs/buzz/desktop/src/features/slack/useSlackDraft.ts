import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
const read = (key: string) => {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
export function useSlackDraft(key: string): [string, (value: SetStateAction<string>) => void] {
  const [draft, setDraft] = useState(() => ({ key, text: read(key) }));
  if (draft.key !== key) setDraft({ key, text: read(key) });
  useEffect(() => {
    try {
      sessionStorage.setItem(draft.key, draft.text);
    } catch {}
  }, [draft]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const update = useCallback(
    (value: SetStateAction<string>) => setDraft((old) => ({ key: currentKey.current, text: typeof value === "function" ? value(old.text) : value })),
    [],
  );
  return [draft.text, update];
}
