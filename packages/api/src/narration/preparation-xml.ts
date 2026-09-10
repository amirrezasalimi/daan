export interface NarrationPreparationSource {
  id: string;
  hash: string;
  originalContent: string;
  processedContent: string | null;
}

export interface NarrationPreviousContext {
  id: string;
  hash: string;
  processedContent: string;
}

export interface NarrationTargetChunk {
  id: string;
  hash: string;
  originalContent: string;
}

export interface NarrationFutureContext {
  id: string;
  hash: string;
  originalContent: string;
}

export interface NarrationPreparationWindow {
  previousContext: NarrationPreviousContext[];
  targets: NarrationTargetChunk[];
  futureContext: NarrationFutureContext[];
}

export interface SelectNarrationWindowInput {
  sources: readonly NarrationPreparationSource[];
  startIndex: number;
  targetCount: number;
  previousContextCount: number;
  futureContextCount: number;
}

export interface BuildNarrationPreparationRequestInput {
  window: NarrationPreparationWindow;
  style: string;
  targetLanguage: string | null;
  quality: string;
  minimumCoverage: number;
}

export interface NarrationPreparedOutputChunk {
  sourceHashes: string[];
  content: string;
}

export interface ParsedNarrationPreparation {
  outputChunks: NarrationPreparedOutputChunk[];
  omittedSourceHashes: string[];
  coveredSourceHashes: string[];
  coverage: number;
}

export interface ParseNarrationPreparationResponseInput {
  xml: string;
  targetHashes: readonly string[];
  minimumCoverage: number;
}

const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi;

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function assertCoverage(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("minimumCoverage must be between 0 and 1");
  }
}

function escapeXml(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const validXmlCharacter =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (!validXmlCharacter) return "";
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    if (character === "'") return "&apos;";
    return character;
  }).join("");
}

function decodeXml(value: string): string {
  return value.replace(XML_ENTITY_PATTERN, (entity) => {
    const normalized = entity.toLowerCase();
    if (normalized === "&amp;") return "&";
    if (normalized === "&lt;") return "<";
    if (normalized === "&gt;") return ">";
    if (normalized === "&quot;") return '"';
    if (normalized === "&apos;") return "'";

    const hexadecimal = normalized.startsWith("&#x");
    const digits = entity.slice(hexadecimal ? 3 : 2, -1);
    const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
    if (
      !Number.isInteger(codePoint) ||
      codePoint < 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      throw new Error(`Invalid XML character reference: ${entity}`);
    }
    return String.fromCodePoint(codePoint);
  });
}

function stripOptionalCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = /^```(?:xml)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function extractRequiredSection(body: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const paired = new RegExp(`<${escapedName}\\s*>([\\s\\S]*?)<\\/${escapedName}\\s*>`, "i").exec(
    body,
  );
  if (paired) return paired[1] ?? "";
  return new RegExp(`<${escapedName}\\s*\\/>`, "i").test(body) ? "" : null;
}

function responsePreview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function extractResponseBody(value: string): string {
  const normalized = stripOptionalCodeFence(value)
    .replace(/^\uFEFF/, "")
    .replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  const root =
    /<narration_preparation_response\b[^>]*>([\s\S]*?)<\/narration_preparation_response\s*>/i.exec(
      normalized,
    );
  if (!root) {
    throw new Error(
      `Invalid narration preparation response root. Received: ${responsePreview(normalized)}`,
    );
  }
  return root[1] ?? "";
}

function assertUniqueTargetHashes(hashes: readonly string[]): Set<string> {
  const targetSet = new Set<string>();
  for (const hash of hashes) {
    if (!hash) throw new Error("Target hashes must be nonempty");
    if (targetSet.has(hash)) throw new Error(`Duplicate target hash: ${hash}`);
    targetSet.add(hash);
  }
  return targetSet;
}

export function selectNarrationPreparationWindow(
  input: SelectNarrationWindowInput,
): NarrationPreparationWindow {
  const { sources } = input;
  assertNonNegativeInteger(input.startIndex, "startIndex");
  assertNonNegativeInteger(input.targetCount, "targetCount");
  assertNonNegativeInteger(input.previousContextCount, "previousContextCount");
  assertNonNegativeInteger(input.futureContextCount, "futureContextCount");

  if (input.targetCount === 0) {
    return { previousContext: [], targets: [], futureContext: [] };
  }

  const startIndex = Math.min(input.startIndex, sources.length);
  const targetEntries: Array<{ source: NarrationPreparationSource; index: number }> = [];
  for (let index = startIndex; index < sources.length; index += 1) {
    const source = sources[index];
    if (source?.processedContent === null) {
      targetEntries.push({ source, index });
      if (targetEntries.length === input.targetCount) break;
    }
  }

  if (targetEntries.length === 0) {
    return { previousContext: [], targets: [], futureContext: [] };
  }

  const firstTargetIndex = targetEntries[0]!.index;
  const lastTargetIndex = targetEntries[targetEntries.length - 1]!.index;
  const previousContext = sources
    .slice(0, firstTargetIndex)
    .filter(
      (source): source is NarrationPreparationSource & { processedContent: string } =>
        source.processedContent !== null,
    )
    .slice(-input.previousContextCount)
    .map(({ id, hash, processedContent }) => ({ id, hash, processedContent }));
  const futureContext = sources
    .slice(lastTargetIndex + 1, lastTargetIndex + 1 + input.futureContextCount)
    .map(({ id, hash, originalContent }) => ({ id, hash, originalContent }));

  return {
    previousContext,
    targets: targetEntries.map(({ source }) => ({
      id: source.id,
      hash: source.hash,
      originalContent: source.originalContent,
    })),
    futureContext,
  };
}

function serializeChunks(
  name: string,
  chunks: readonly { id: string; hash: string; content: string }[],
): string {
  const serialized = chunks
    .map(
      (chunk) =>
        `    <chunk id="${escapeXml(chunk.id)}" hash="${escapeXml(chunk.hash)}">${escapeXml(chunk.content)}</chunk>`,
    )
    .join("\n");
  return serialized ? `  <${name}>\n${serialized}\n  </${name}>` : `  <${name} />`;
}

export function buildNarrationPreparationRequest(
  input: BuildNarrationPreparationRequestInput,
): string {
  assertCoverage(input.minimumCoverage);
  assertUniqueTargetHashes(input.window.targets.map((target) => target.hash));

  const previous = input.window.previousContext.map((chunk) => ({
    id: chunk.id,
    hash: chunk.hash,
    content: chunk.processedContent,
  }));
  const targets = input.window.targets.map((chunk) => ({
    id: chunk.id,
    hash: chunk.hash,
    content: chunk.originalContent,
  }));
  const future = input.window.futureContext.map((chunk) => ({
    id: chunk.id,
    hash: chunk.hash,
    content: chunk.originalContent,
  }));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<narration_preparation_request>",
    "  <instructions>Rewrite only target chunks into polished, natural narration while preserving every fact, name, event, and uncertainty from the source. Never invent, infer, summarize away, or contradict information. Translate only when target_language is not none. Context is reference-only and must not be included in source hash accounting. Return the exact response structure shown in expected_response. Every target hash must be covered by output chunks or listed in omitted_source_hashes, but never both. Output chunks may merge adjacent targets or split one source group into multiple outputs, so their count may differ from the target count. Split outputs must repeat the exact same source_hashes group.</instructions>",
    `  <style>${escapeXml(input.style)}</style>`,
    `  <target_language>${escapeXml(input.targetLanguage?.trim() || "none")}</target_language>`,
    `  <quality>${escapeXml(input.quality)}</quality>`,
    `  <minimum_coverage>${input.minimumCoverage}</minimum_coverage>`,
    serializeChunks("previous_processed_context", previous),
    serializeChunks("target_original_chunks", targets),
    serializeChunks("future_original_context", future),
    "  <expected_response>",
    "    <narration_preparation_response>",
    '      <output_chunks><output_chunk source_hashes="TARGET_HASH [TARGET_HASH ...]">ESCAPED_NARRATION_TEXT</output_chunk></output_chunks>',
    "      <omitted_source_hashes><source_hash>TARGET_HASH</source_hash></omitted_source_hashes>",
    "    </narration_preparation_response>",
    "  </expected_response>",
    "</narration_preparation_request>",
  ].join("\n");
}

export function parseNarrationPreparationResponse(
  input: ParseNarrationPreparationResponseInput,
): ParsedNarrationPreparation {
  assertCoverage(input.minimumCoverage);
  const targets = assertUniqueTargetHashes(input.targetHashes);
  if (targets.size === 0) throw new Error("At least one target hash is required");

  const xml = stripOptionalCodeFence(input.xml);
  const body = extractResponseBody(xml);
  const outputSection = extractRequiredSection(body, "output_chunks");
  const omittedSection = extractRequiredSection(body, "omitted_source_hashes");
  if (outputSection === null || omittedSection === null) {
    throw new Error(
      `Response must contain output_chunks and omitted_source_hashes. Received: ${responsePreview(xml)}`,
    );
  }

  const outputChunks: NarrationPreparedOutputChunk[] = [];
  const covered = new Set<string>();
  const coverageGroups: string[][] = [];
  const outputPattern =
    /<output_chunk\s+source_hashes\s*=\s*(["'])(.*?)\1\s*>([\s\S]*?)<\/output_chunk\s*>/gi;
  let outputMatch: RegExpExecArray | null;
  while ((outputMatch = outputPattern.exec(outputSection)) !== null) {
    const hashes = [...new Set((outputMatch[2] ?? "").trim().split(/\s+/).filter(Boolean))];
    if (hashes.length === 0) throw new Error("An output chunk must reference a target hash");
    for (const hash of hashes) {
      if (!targets.has(hash)) throw new Error(`Unknown source hash: ${hash}`);
    }
    const overlappingGroup = coverageGroups.find((group) =>
      group.some((hash) => hashes.includes(hash)),
    );
    if (
      overlappingGroup &&
      (overlappingGroup.length !== hashes.length ||
        overlappingGroup.some((hash, index) => hash !== hashes[index]))
    ) {
      throw new Error("Overlapping output chunks must reference the same source hashes");
    }
    if (!overlappingGroup) coverageGroups.push(hashes);
    hashes.forEach((hash) => covered.add(hash));
    const rawContent = outputMatch[3] ?? "";
    if (/<[^>]*>/.test(rawContent)) throw new Error("Output chunk content must be escaped text");
    const content = decodeXml(rawContent).trim();
    if (!content) throw new Error("Output chunks must have nonempty content");
    outputChunks.push({ sourceHashes: hashes, content });
  }
  if (outputSection.replace(outputPattern, "").trim()) {
    throw new Error("Invalid content in output_chunks");
  }

  const omittedSourceHashes: string[] = [];
  const omitted = new Set<string>();
  const omittedPattern = /<source_hash\s*>([^<]*)<\/source_hash\s*>/gi;
  let omittedMatch: RegExpExecArray | null;
  while ((omittedMatch = omittedPattern.exec(omittedSection)) !== null) {
    const hash = decodeXml(omittedMatch[1] ?? "").trim();
    if (!hash) throw new Error("Omitted source hashes must be nonempty");
    if (!targets.has(hash)) throw new Error(`Unknown omitted source hash: ${hash}`);
    if (covered.has(hash))
      throw new Error(`Source hash cannot be both covered and omitted: ${hash}`);
    if (!omitted.has(hash)) {
      omitted.add(hash);
      omittedSourceHashes.push(hash);
    }
  }
  if (omittedSection.replace(omittedPattern, "").trim()) {
    throw new Error("Invalid content in omitted_source_hashes");
  }

  for (const hash of targets) {
    if (!covered.has(hash) && !omitted.has(hash)) {
      throw new Error(`Target source hash is not accounted for: ${hash}`);
    }
  }

  const coverage = covered.size / targets.size;
  if (coverage < input.minimumCoverage) {
    throw new Error(
      `Narration coverage ${coverage.toFixed(4)} is below minimum ${input.minimumCoverage.toFixed(4)}`,
    );
  }

  return {
    outputChunks,
    omittedSourceHashes,
    coveredSourceHashes: [...covered],
    coverage,
  };
}
