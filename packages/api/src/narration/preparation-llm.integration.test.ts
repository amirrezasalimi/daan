import { expect, test } from "bun:test";
import OpenAI from "openai";

import { readConfig } from "../config";
import {
  buildNarrationPreparationRequest,
  parseNarrationPreparationResponse,
  type NarrationPreparationWindow,
} from "./preparation-xml";

const integrationTest = process.env.RUN_LLM_INTEGRATION === "1" ? test : test.skip;

const HASHES = {
  previous: "a".repeat(64),
  targets: ["b".repeat(64), "c".repeat(64), "d".repeat(64), "e".repeat(64)],
  future: ["f".repeat(64), "1".repeat(64)],
} as const;

integrationTest(
  "configured LLM returns a valid narration preparation response",
  async () => {
    const config = readConfig();
    const preparation = config.narrationPreparation;
    expect(preparation.enabled).toBe(true);

    const provider = config.llmServices.find((service) => service.id === preparation.model.service);
    if (!provider) throw new Error("Configured narration preparation provider was not found");
    if (!preparation.model.model) throw new Error("Narration preparation model is not configured");

    const window: NarrationPreparationWindow = {
      previousContext: [
        {
          id: "previous-1",
          hash: HASHES.previous,
          processedContent:
            "Mara closed the station ledger and listened as the midnight train approached.",
        },
      ],
      targets: [
        {
          id: "target-1",
          hash: HASHES.targets[0],
          originalContent:
            "The platform clock showed eleven fifty-eight. Mara checked it twice, because it had stopped the night her brother disappeared.",
        },
        {
          id: "target-2",
          hash: HASHES.targets[1],
          originalContent:
            "A porter named Elias crossed the empty platform carrying a red suitcase that did not belong to him.",
        },
        {
          id: "target-3",
          hash: HASHES.targets[2],
          originalContent:
            '"You should leave before the train arrives," he said. He did not explain why.',
        },
        {
          id: "target-4",
          hash: HASHES.targets[3],
          originalContent:
            "Mara stayed. The rails began to sing, softly at first, then loud enough to shake dust from the rafters.",
        },
      ],
      futureContext: [
        {
          id: "future-1",
          hash: HASHES.future[0],
          originalContent:
            "The locomotive emerged from the fog without headlights and stopped at the abandoned platform.",
        },
        {
          id: "future-2",
          hash: HASHES.future[1],
          originalContent: "No doors opened.",
        },
      ],
    };
    const request = buildNarrationPreparationRequest({
      window,
      style: config.narrateStyle,
      targetLanguage: preparation.targetLanguage || null,
      quality: preparation.quality,
      minimumCoverage: preparation.minimumCoveragePercent / 100,
    });
    const client = new OpenAI({
      baseURL: provider.endpoint,
      apiKey: provider.apiKey || "not-needed",
    });
    const response = await client.chat.completions.create({
      model: preparation.model.model,
      temperature: 0.1,
      max_completion_tokens: 5_000,
      messages: [
        { role: "system", content: "Return only strict XML for narration preparation." },
        { role: "user", content: request },
      ],
    });
    const raw = response.choices[0]?.message.content ?? "";

    try {
      const parsed = parseNarrationPreparationResponse({
        xml: raw,
        targetHashes: HASHES.targets,
        minimumCoverage: preparation.minimumCoveragePercent / 100,
      });
      expect(parsed.outputChunks.length).toBeGreaterThan(0);
      expect(parsed.coveredSourceHashes.length + parsed.omittedSourceHashes.length).toBe(
        HASHES.targets.length,
      );
    } catch (error) {
      const preview = raw.replace(/\s+/g, " ").trim().slice(0, 2_000);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nConfigured LLM response: ${preview}`,
      );
    }
  },
  120_000,
);
