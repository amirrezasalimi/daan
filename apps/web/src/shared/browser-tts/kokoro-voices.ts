import type { BrowserTtsVoice } from "./types";

const VOICE_GROUPS = {
  af: [
    "heart",
    "alloy",
    "aoede",
    "bella",
    "jessica",
    "kore",
    "nicole",
    "nova",
    "river",
    "sarah",
    "sky",
  ],
  am: ["adam", "echo", "eric", "fenrir", "liam", "michael", "onyx", "puck", "santa"],
  bf: ["alice", "emma", "isabella", "lily"],
  bm: ["daniel", "fable", "george", "lewis"],
} as const;

const VOICE_META: Record<string, { language: string; gender: string }> = {
  af: { language: "American English", gender: "Female" },
  am: { language: "American English", gender: "Male" },
  bf: { language: "British English", gender: "Female" },
  bm: { language: "British English", gender: "Male" },
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const KOKORO_VOICES: BrowserTtsVoice[] = Object.entries(VOICE_GROUPS).flatMap(
  ([prefix, names]) =>
    names.map((name) => ({
      id: `${prefix}_${name}`,
      name: titleCase(name),
      language: VOICE_META[prefix]!.language,
      gender: VOICE_META[prefix]!.gender,
    })),
);
