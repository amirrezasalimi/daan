import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import YAML from "yaml";

import {
  type AppConfig,
  appConfigSchema,
  BUILTIN_KOKORO_SERVICE,
  BUILTIN_POCKET_TTS_SERVICE,
  DEFAULT_CONFIG,
} from "./schema";

const BUILTIN_BROWSER_SERVICES = [BUILTIN_KOKORO_SERVICE, BUILTIN_POCKET_TTS_SERVICE];

const CONFIG_FILENAME = "config.yaml";

/**
 * Walk up from the current working directory to find the monorepo root
 * (identified by a package.json that declares workspaces). Falls back to cwd.
 */
export function findProjectRoot(): string {
  let dir = process.cwd();

  for (let i = 0; i < 12; i += 1) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          workspaces?: unknown;
        };
        if (pkg.workspaces) {
          return dir;
        }
      } catch {
        // ignore malformed package.json and keep walking up
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

export function getConfigPath(): string {
  return join(findProjectRoot(), CONFIG_FILENAME);
}

/**
 * Read and validate the config file. Missing or invalid values are backfilled
 * with defaults via the zod schema.
 */
export function readConfig(): AppConfig {
  const path = getConfigPath();

  if (!existsSync(path)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = YAML.parse(raw) ?? {};
    const config = appConfigSchema.parse(parsed);
    for (const builtin of [...BUILTIN_BROWSER_SERVICES].reverse()) {
      const existingIndex = config.ttsServices.findIndex((service) => service.id === builtin.id);
      if (existingIndex === -1) {
        config.ttsServices.unshift(structuredClone(builtin));
      } else {
        config.ttsServices[existingIndex] = structuredClone(builtin);
      }
    }
    const selectedBuiltin = BUILTIN_BROWSER_SERVICES.find(
      (service) => service.id === config.defaultTtsModel.service,
    );
    if (
      selectedBuiltin &&
      !selectedBuiltin.models.some((model) => model.id === config.defaultTtsModel.model)
    ) {
      config.defaultTtsModel = {
        service: selectedBuiltin.id,
        model: selectedBuiltin.models[0]!.id,
        voice: config.defaultTtsModel.voice || selectedBuiltin.models[0]!.voices[0]!,
      };
    }
    if (!config.defaultTtsModel.service) {
      config.defaultTtsModel = structuredClone(DEFAULT_CONFIG.defaultTtsModel);
    }
    return config;
  } catch (error) {
    console.error(`Failed to read ${CONFIG_FILENAME}:`, error);
    return structuredClone(DEFAULT_CONFIG);
  }
}

/**
 * Validate and persist the config file as YAML.
 */
export function writeConfig(config: AppConfig): AppConfig {
  const validated = appConfigSchema.parse(config);
  const path = getConfigPath();
  const yaml = YAML.stringify(validated);
  writeFileSync(path, yaml, "utf8");
  return validated;
}
