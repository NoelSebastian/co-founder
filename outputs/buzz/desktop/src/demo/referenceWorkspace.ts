import type { RelayEvent } from "@/shared/api/types";

export const SELF = "deadbeef".repeat(8);
export const WELCOME = "3aa8c6b5-21f2-5e6e-92e6-4c72c2280cfc";
export const AGENTS = ["Fizz", "Honey", "Pollen"].map((name, index) => ({
  name,
  personaId: ["builtin:fizz", "builtin:honey", "builtin:bumble"][index],
  pubkey: String(index + 1).repeat(64),
  avatarUrl: `/demo-avatars/${name.toLowerCase()}.png`,
}));

/** Local reference data transcribed from the user's visible Buzz workspace. */
export function referenceWorkspace() {
  const fizz = AGENTS[0];
  const channels = [
    {
      id: "9a1657ac-f7aa-5db0-b632-d8bbeb6dfb50",
      name: "general",
      description: "General discussion for everyone",
      visibility: "open" as const,
      memberPubkeys: [SELF],
    },
    {
      id: "cbb08eeb-367e-40aa-aee3-8eec052fdcb5",
      name: "Welcome",
      description: "",
      visibility: "private" as const,
      memberPubkeys: [SELF, ...AGENTS.map((a) => a.pubkey)],
    },
    {
      id: WELCOME,
      name: "welcome-everyone",
      description: "Say hi, ask a question, or share what brought you here.",
      visibility: "open" as const,
      memberPubkeys: [SELF, fizz.pubkey],
    },
  ];
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(22, 5, 0, 0);
  const start = Math.floor(date.getTime() / 1000);
  const offsets = [0, 40, 120, 150, 180, 210, 240, 360, 420];
  const mention = "@Fizz";
  const messages = [
    "what can I do",
    "are you there_",
    `${mention} are you there`,
    `${mention} are you there?`,
    `${mention} are you there?`,
    "who are you?",
    `${mention} @`,
    `${mention} Can you for the love of god say something back. feel like im talking to a wall`,
    `${mention} are you there?`,
  ];
  const events: RelayEvent[] = messages.map((content, index) => ({
    id: (index + 100).toString(16).padStart(64, "0"),
    pubkey: SELF,
    kind: 9,
    content,
    created_at: start + offsets[index],
    tags: [
      ["h", WELCOME],
      ...(content.includes(mention) ? [["p", fizz.pubkey]] : []),
    ],
    sig: "0".repeat(128),
  }));
  for (const index of [4, 6, 7]) {
    events.push({
      id: (index + 200).toString(16).padStart(64, "0"),
      pubkey: fizz.pubkey,
      kind: 7,
      content: "👀",
      created_at: start + offsets[index] + 2,
      tags: [
        ["h", WELCOME],
        ["e", events[index].id],
      ],
      sig: "0".repeat(128),
    });
  }
  for (const [index, pubkey] of [SELF, fizz.pubkey].entries()) {
    events.push({
      id: (index + 300).toString(16).padStart(64, "0"),
      pubkey,
      kind: 7,
      content: "💬",
      created_at: start + 165,
      tags: [
        ["h", WELCOME],
        ["e", events[4].id],
      ],
      sig: "0".repeat(128),
    });
  }
  const configurationReply = [
    "```buzz:config-nudge",
    JSON.stringify({
      agent_name: "Fizz",
      agent_pubkey: fizz.pubkey,
      requirements: [
        { surface: "normalized_field", field: "provider" },
        { surface: "normalized_field", field: "model" },
      ],
    }),
    "```",
  ].join("\n");
  for (const index of [2, 3, 8]) {
    events.push({
      id: (index + 400).toString(16).padStart(64, "0"),
      pubkey: fizz.pubkey,
      kind: 9,
      content: configurationReply,
      created_at: start + offsets[index] + 5,
      tags: [
        ["h", WELCOME],
        ["p", SELF],
        ["e", events[index].id, "", "reply"],
      ],
      sig: "0".repeat(128),
    });
  }
  return { channels, events };
}
