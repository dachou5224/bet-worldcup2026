import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();
  return { key, value };
}

export function loadLocalEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (!(parsed.key in process.env)) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

/** .env 未设置的变量，从 .env.example 补全（便于本地探测；密钥仍应只放 .env） */
export function loadEnvExampleFallback() {
  const examplePath = path.join(projectRoot, ".env.example");
  if (!existsSync(examplePath)) {
    return;
  }

  for (const line of readFileSync(examplePath, "utf-8").split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || parsed.key in process.env || !parsed.value) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }
}

export function loadProjectEnv() {
  loadLocalEnv();
  loadEnvExampleFallback();
}
