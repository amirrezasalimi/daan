import { spawn } from "node:child_process";

import type { Socks5ProxyConfig, TtsServiceConfig } from "../config/schema";

interface GenerateSpeechInput {
  service: TtsServiceConfig;
  model: string;
  voice: string;
  text: string;
  proxy: Socks5ProxyConfig;
}

function proxyArguments(proxy: Socks5ProxyConfig): string[] {
  if (!proxy.enabled) return [];
  if (!/^socks5h?:\/\/[^\s]+$/i.test(proxy.url)) {
    throw new Error("The configured SOCKS5 proxy URL is invalid");
  }
  return ["--proxy", proxy.url];
}

function safeProviderError(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "The TTS provider request failed";
  return compact.slice(0, 300);
}

function escapeCurlConfig(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function curlAudio(args: string[], authorization: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", ["-sS", "--fail-with-body", "--config", "-", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.once("error", () => reject(new Error("Could not start the TTS request")));
    child.once("close", (code) => {
      if (code !== 0) {
        const providerBody = Buffer.concat(output).toString("utf8");
        const curlError = Buffer.concat(errors).toString("utf8");
        reject(new Error(safeProviderError(providerBody || curlError)));
        return;
      }
      const audio = Buffer.concat(output);
      if (audio.byteLength === 0) {
        reject(new Error("The TTS provider returned empty audio"));
        return;
      }
      resolve(new Uint8Array(audio));
    });
    child.stdin.end(`header = "Authorization: ${escapeCurlConfig(authorization)}"\n`);
  });
}

export async function generateSpeech(input: GenerateSpeechInput): Promise<Uint8Array> {
  const endpoint = input.service.endpoint.replace(/\/$/, "");
  const body =
    input.service.provider === "deepgram"
      ? JSON.stringify({ text: input.text })
      : JSON.stringify({
          model: input.model,
          voice: input.voice,
          input: input.text,
          response_format: "mp3",
        });
  const url =
    input.service.provider === "deepgram"
      ? `${endpoint}/speak?model=${encodeURIComponent(input.model)}&encoding=mp3`
      : `${endpoint}/audio/speech`;
  const authorization = `${input.service.provider === "deepgram" ? "Token" : "Bearer"} ${input.service.apiKey}`;

  return curlAudio(
    [
      ...proxyArguments(input.proxy),
      "--max-time",
      "120",
      "-X",
      "POST",
      url,
      "-H",
      "Content-Type: application/json",
      "-d",
      body,
    ],
    authorization,
  );
}
