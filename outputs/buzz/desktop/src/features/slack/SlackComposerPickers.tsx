import { slackNativeEmoji } from "./slackEmoji";
import { useState } from "react";
import { AtSign, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { userName, type SlackUser } from "./api";
const common = slackNativeEmoji;
export function SlackComposerPickers({
  emoji,
  users,
  onInsert,
}: {
  emoji: Record<string, string>;
  users: Record<string, SlackUser>;
  onInsert: (text: string) => void;
}) {
  const [opened, setOpened] = useState<"emoji" | "mention" | null>(null),
    [query, setQuery] = useState("");
  const insert = (text: string) => {
    onInsert(text);
    setOpened(null);
    setQuery("");
  };
  const image = (name: string) => {
    let value = emoji[name];
    for (let i = 0; i < 5 && value?.startsWith("alias:"); i++)
      value = emoji[value.slice(6)];
    return /^https:\/\//.test(value || "") ? value : "";
  };
  return (
    <>
      {(["emoji", "mention"] as const).map((kind) => (
        <Popover
          key={kind}
          open={opened === kind}
          onOpenChange={(v) => {
            setOpened(v ? kind : null);
            setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={kind === "emoji" ? "Insert emoji" : "Mention someone"}
              title={kind === "emoji" ? "Emoji" : "Mention someone"}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            >
              {kind === "emoji" ? (
                <Smile className="h-4 w-4" />
              ) : (
                <AtSign className="h-4 w-4" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-80 p-3">
            <input
              autoFocus
              aria-label={kind === "emoji" ? "Search emoji" : "Search people"}
              placeholder={kind === "emoji" ? "Search emoji" : "Find a person"}
              className="mb-3 w-full rounded border px-3 py-2 text-sm outline-none focus:border-primary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {kind === "emoji" ? (
              <div className="grid max-h-64 grid-cols-7 gap-1 overflow-y-auto">
                {[...new Set([...Object.keys(common), ...Object.keys(emoji)])]
                  .filter((name) => name.includes(query.toLowerCase()))
                  .map((name) => (
                    <button
                      type="button"
                      className="flex h-9 items-center justify-center rounded hover:bg-muted"
                      title={name}
                      aria-label={`Insert ${name}`}
                      key={name}
                      onClick={() => insert(common[name] || `:${name}:`)}
                    >
                      {common[name] ||
                        (image(name) ? (
                          <img
                            className="h-6 w-6 object-contain"
                            src={image(name)}
                            alt={name}
                          />
                        ) : (
                          <span className="truncate text-xs">{name}</span>
                        ))}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {Object.values(users)
                  .filter((u) =>
                    userName(u).toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((u) => (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                      key={u.id}
                      onClick={() => insert(` <@${u.id}> `)}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-xs">
                        {userName(u).slice(0, 1)}
                      </span>
                      {userName(u)}
                    </button>
                  ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      ))}
    </>
  );
}
