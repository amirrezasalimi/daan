import { describe, expect, test } from "bun:test";

import {
  buildNarrationPreparationRequest,
  parseNarrationPreparationResponse,
  selectNarrationPreparationWindow,
  type NarrationPreparationSource,
} from "./preparation-xml";

const response = (outputs: string, omitted = ""): string => `
<narration_preparation_response>
  <output_chunks>${outputs}</output_chunks>
  <omitted_source_hashes>${omitted}</omitted_source_hashes>
</narration_preparation_response>`;

describe("buildNarrationPreparationRequest", () => {
  test("strictly escapes content and represents no target language explicitly", () => {
    const xml = buildNarrationPreparationRequest({
      window: {
        previousContext: [
          {
            id: "previous<&\"'",
            hash: "previous-hash",
            processedContent: "Already <prepared> & spoken",
          },
        ],
        targets: [
          {
            id: "target-1",
            hash: 'target&"hash',
            originalContent: "Use <this> & that \"quote\" 'apostrophe'",
          },
        ],
        futureContext: [
          {
            id: "future-1",
            hash: "future-hash",
            originalContent: "Later > sooner",
          },
        ],
      },
      style: "Warm & clear <voice>",
      targetLanguage: null,
      quality: 'high "fidelity"',
      minimumCoverage: 0.75,
    });

    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<target_language>none</target_language>");
    expect(xml).toContain("<style>Warm &amp; clear &lt;voice&gt;</style>");
    expect(xml).toContain("<quality>high &quot;fidelity&quot;</quality>");
    expect(xml).toContain("<minimum_coverage>0.75</minimum_coverage>");
    expect(xml).toContain(
      'id="previous&lt;&amp;&quot;&apos;" hash="previous-hash">Already &lt;prepared&gt; &amp; spoken',
    );
    expect(xml).toContain('hash="target&amp;&quot;hash"');
    expect(xml).toContain("Use &lt;this&gt; &amp; that &quot;quote&quot; &apos;apostrophe&apos;");
    expect(xml).toContain("Later &gt; sooner");
    expect(xml).toContain('<output_chunk source_hashes="TARGET_HASH [TARGET_HASH ...]">');
    expect(xml).toContain("<omitted_source_hashes><source_hash>TARGET_HASH</source_hash>");
    expect(xml).not.toContain("Already <prepared>");
  });

  test("uses none semantics for blank target language", () => {
    const xml = buildNarrationPreparationRequest({
      window: { previousContext: [], targets: [], futureContext: [] },
      style: "neutral",
      targetLanguage: "   ",
      quality: "standard",
      minimumCoverage: 0,
    });

    expect(xml).toContain("<target_language>none</target_language>");
    expect(xml).toContain("<previous_processed_context />");
    expect(xml).toContain("<target_original_chunks />");
    expect(xml).toContain("<future_original_context />");
  });
});

describe("parseNarrationPreparationResponse", () => {
  test("accepts fenced XML and merged variable-count output", () => {
    const xml = `\`\`\`xml
${response('<output_chunk source_hashes="a b">Merged &amp; polished.</output_chunk>')}
\`\`\``;
    const parsed = parseNarrationPreparationResponse({
      xml,
      targetHashes: ["a", "b"],
      minimumCoverage: 1,
    });

    expect(parsed.outputChunks).toEqual([
      { sourceHashes: ["a", "b"], content: "Merged & polished." },
    ]);
    expect(parsed.coveredSourceHashes).toEqual(["a", "b"]);
    expect(parsed.omittedSourceHashes).toEqual([]);
    expect(parsed.coverage).toBe(1);
  });

  test("accepts split output and deduplicates hashes within one output", () => {
    const parsed = parseNarrationPreparationResponse({
      xml: response(
        '<output_chunk source_hashes="a a">Part one.</output_chunk>\n' +
          '<output_chunk source_hashes="a">Part two.</output_chunk>\n' +
          '<output_chunk source_hashes="b b-tail">Part three.</output_chunk>',
      ),
      targetHashes: ["a", "b", "b-tail"],
      minimumCoverage: 1,
    });

    expect(parsed.outputChunks).toHaveLength(3);
    expect(parsed.outputChunks[0]?.sourceHashes).toEqual(["a"]);
    expect(parsed.outputChunks[1]?.sourceHashes).toEqual(["a"]);
    expect(parsed.coverage).toBe(1);
  });

  test("accepts XML declarations and harmless response wrappers", () => {
    const parsed = parseNarrationPreparationResponse({
      xml: `Here is the requested XML:\n<?xml version="1.0" encoding="UTF-8"?>\n<response>\n${response(
        '<output_chunk source_hashes="a">Prepared.</output_chunk>',
      )}\n</response>`,
      targetHashes: ["a"],
      minimumCoverage: 1,
    });

    expect(parsed.outputChunks).toEqual([{ sourceHashes: ["a"], content: "Prepared." }]);
  });

  test("accepts self-closing empty required sections", () => {
    const parsed = parseNarrationPreparationResponse({
      xml: `
<narration_preparation_response>
  <output_chunks>
    <output_chunk source_hashes="a">Prepared.</output_chunk>
  </output_chunks>
  <omitted_source_hashes />
</narration_preparation_response>`,
      targetHashes: ["a"],
      minimumCoverage: 1,
    });

    expect(parsed.outputChunks).toEqual([{ sourceHashes: ["a"], content: "Prepared." }]);
    expect(parsed.omittedSourceHashes).toEqual([]);
  });

  test("accepts explicitly omitted chunks and deduplicates omissions", () => {
    const parsed = parseNarrationPreparationResponse({
      xml: response(
        '<output_chunk source_hashes="a b">Prepared.</output_chunk>',
        "<source_hash>c</source_hash><source_hash>c</source_hash>",
      ),
      targetHashes: ["a", "b", "c"],
      minimumCoverage: 2 / 3,
    });

    expect(parsed.omittedSourceHashes).toEqual(["c"]);
    expect(parsed.coveredSourceHashes).toEqual(["a", "b"]);
    expect(parsed.coverage).toBeCloseTo(2 / 3);
  });

  test("rejects unknown covered and omitted hashes", () => {
    expect(() =>
      parseNarrationPreparationResponse({
        xml: response('<output_chunk source_hashes="unknown">Text.</output_chunk>'),
        targetHashes: ["a"],
        minimumCoverage: 0,
      }),
    ).toThrow("Unknown source hash: unknown");

    expect(() =>
      parseNarrationPreparationResponse({
        xml: response("", "<source_hash>unknown</source_hash>"),
        targetHashes: ["a"],
        minimumCoverage: 0,
      }),
    ).toThrow("Unknown omitted source hash: unknown");
  });

  test("rejects overlapping accounting groups or covered and omitted sets", () => {
    expect(() =>
      parseNarrationPreparationResponse({
        xml: response(
          '<output_chunk source_hashes="a b">One.</output_chunk>' +
            '<output_chunk source_hashes="b">Two.</output_chunk>',
        ),
        targetHashes: ["a", "b"],
        minimumCoverage: 1,
      }),
    ).toThrow("Overlapping output chunks must reference the same source hashes");

    expect(() =>
      parseNarrationPreparationResponse({
        xml: response(
          '<output_chunk source_hashes="a">One.</output_chunk>',
          "<source_hash>a</source_hash>",
        ),
        targetHashes: ["a"],
        minimumCoverage: 1,
      }),
    ).toThrow("Source hash cannot be both covered and omitted: a");
  });

  test("requires every target hash to be accounted for", () => {
    expect(() =>
      parseNarrationPreparationResponse({
        xml: response('<output_chunk source_hashes="a">One.</output_chunk>'),
        targetHashes: ["a", "b"],
        minimumCoverage: 0.5,
      }),
    ).toThrow("Target source hash is not accounted for: b");
  });

  test("rejects coverage below the requested threshold", () => {
    expect(() =>
      parseNarrationPreparationResponse({
        xml: response(
          '<output_chunk source_hashes="a">One.</output_chunk>',
          "<source_hash>b</source_hash><source_hash>c</source_hash>",
        ),
        targetHashes: ["a", "b", "c"],
        minimumCoverage: 0.5,
      }),
    ).toThrow("below minimum");
  });

  test("accepts self-closing output_chunks when every target is omitted", () => {
    const parsed = parseNarrationPreparationResponse({
      xml: `
<narration_preparation_response>
  <output_chunks />
  <omitted_source_hashes><source_hash>a</source_hash></omitted_source_hashes>
</narration_preparation_response>`,
      targetHashes: ["a"],
      minimumCoverage: 0,
    });

    expect(parsed.outputChunks).toEqual([]);
    expect(parsed.omittedSourceHashes).toEqual(["a"]);
  });

  test("rejects empty outputs and malformed extra section content", () => {
    expect(() =>
      parseNarrationPreparationResponse({
        xml: response('<output_chunk source_hashes="a">   </output_chunk>'),
        targetHashes: ["a"],
        minimumCoverage: 1,
      }),
    ).toThrow("nonempty content");

    expect(() =>
      parseNarrationPreparationResponse({
        xml: response('<other source_hashes="a">Text.</other>'),
        targetHashes: ["a"],
        minimumCoverage: 0,
      }),
    ).toThrow("Invalid content in output_chunks");
  });
});

describe("selectNarrationPreparationWindow", () => {
  const sources: NarrationPreparationSource[] = [
    { id: "0", hash: "h0", originalContent: "O0", processedContent: "P0" },
    { id: "1", hash: "h1", originalContent: "O1", processedContent: "P1" },
    { id: "2", hash: "h2", originalContent: "O2", processedContent: null },
    { id: "3", hash: "h3", originalContent: "O3", processedContent: "P3" },
    { id: "4", hash: "h4", originalContent: "O4", processedContent: null },
    { id: "5", hash: "h5", originalContent: "O5", processedContent: null },
    { id: "6", hash: "h6", originalContent: "O6", processedContent: "P6" },
    { id: "7", hash: "h7", originalContent: "O7", processedContent: null },
  ];

  test("counts only unprocessed chunks as targets and bounds context", () => {
    const window = selectNarrationPreparationWindow({
      sources,
      startIndex: 1,
      targetCount: 2,
      previousContextCount: 1,
      futureContextCount: 2,
    });

    expect(window.previousContext).toEqual([{ id: "1", hash: "h1", processedContent: "P1" }]);
    expect(window.targets).toEqual([
      { id: "2", hash: "h2", originalContent: "O2" },
      { id: "4", hash: "h4", originalContent: "O4" },
    ]);
    expect(window.futureContext).toEqual([
      { id: "5", hash: "h5", originalContent: "O5" },
      { id: "6", hash: "h6", originalContent: "O6" },
    ]);
  });

  test("honors start and collection boundaries", () => {
    const window = selectNarrationPreparationWindow({
      sources,
      startIndex: 5,
      targetCount: 5,
      previousContextCount: 2,
      futureContextCount: 5,
    });

    expect(window.previousContext.map((chunk) => chunk.id)).toEqual(["1", "3"]);
    expect(window.targets.map((chunk) => chunk.id)).toEqual(["5", "7"]);
    expect(window.futureContext).toEqual([]);
  });

  test("returns an empty window for zero targets, an out-of-range start, or no remaining targets", () => {
    const base = {
      sources,
      previousContextCount: 2,
      futureContextCount: 2,
    };

    expect(selectNarrationPreparationWindow({ ...base, startIndex: 0, targetCount: 0 })).toEqual({
      previousContext: [],
      targets: [],
      futureContext: [],
    });
    expect(selectNarrationPreparationWindow({ ...base, startIndex: 99, targetCount: 2 })).toEqual({
      previousContext: [],
      targets: [],
      futureContext: [],
    });
    expect(
      selectNarrationPreparationWindow({
        sources: sources.slice(0, 2),
        startIndex: 0,
        targetCount: 2,
        previousContextCount: 2,
        futureContextCount: 2,
      }),
    ).toEqual({ previousContext: [], targets: [], futureContext: [] });
  });
});
