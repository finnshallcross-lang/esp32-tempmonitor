// Shared config keys, defaults, and sensor fetch helper.

import { storage } from "@/src/utils/storage";

export const CONFIG_KEYS = {
  endpoint: "esp32.endpoint",
  interval: "esp32.interval",
  demo: "esp32.demo",
  sampleInterval: "esp32.sampleInterval",
} as const;

export const DEFAULT_ENDPOINT = "http://192.168.68.71/data";
export const DEFAULT_INTERVAL_MS = 5000;
export const DEFAULT_SAMPLE_INTERVAL_MS = 15 * 60 * 1000;
export const REFRESH_INTERVALS = [
  { label: "2s", ms: 2000 },
  { label: "5s", ms: 5000 },
  { label: "10s", ms: 10000 },
];
export const SAMPLE_INTERVALS = [
  { label: "1 min", ms: 60 * 1000 },
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "30 min", ms: 30 * 60 * 1000 },
  { label: "1 hr", ms: 60 * 60 * 1000 },
];

export type SensorReading = {
  temperature: number | null;
  humidity: number | null;
  brightness: number | null;
};

export type SensorConfig = {
  endpoint: string;
  intervalMs: number;
  demo: boolean;
  sampleIntervalMs: number;
};

export async function loadConfig(): Promise<SensorConfig> {
  const [endpoint, interval, demo, sampleInterval] = await Promise.all([
    storage.getItem(CONFIG_KEYS.endpoint, DEFAULT_ENDPOINT),
    storage.getItem(CONFIG_KEYS.interval, DEFAULT_INTERVAL_MS),
    storage.getItem(CONFIG_KEYS.demo, false),
    storage.getItem(CONFIG_KEYS.sampleInterval, DEFAULT_SAMPLE_INTERVAL_MS),
  ]);
  return {
    endpoint: (endpoint as string) || DEFAULT_ENDPOINT,
    intervalMs: (interval as number) || DEFAULT_INTERVAL_MS,
    demo: Boolean(demo),
    sampleIntervalMs:
      (sampleInterval as number) || DEFAULT_SAMPLE_INTERVAL_MS,
  };
}

export async function saveConfig(cfg: SensorConfig): Promise<void> {
  await Promise.all([
    storage.setItem(CONFIG_KEYS.endpoint, cfg.endpoint),
    storage.setItem(CONFIG_KEYS.interval, cfg.intervalMs),
    storage.setItem(CONFIG_KEYS.demo, cfg.demo),
    storage.setItem(CONFIG_KEYS.sampleInterval, cfg.sampleIntervalMs),
  ]);
}

// Pull common sensor keys out of whatever JSON shape the ESP32 returns.
// We intentionally ignore any 'time' / 'timestamp' fields per the spec.
function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

export function normalizeReading(raw: unknown): SensorReading {
  if (!raw || typeof raw !== "object") {
    return { temperature: null, humidity: null, brightness: null };
  }
  const o = raw as Record<string, unknown>;
  return {
    temperature: pickNumber(o, ["temperature", "temp", "t"]),
    humidity: pickNumber(o, ["humidity", "hum", "h"]),
    brightness: pickNumber(o, ["brightness", "light", "lux", "b"]),
  };
}

export function resolveFetchUrl(cfg: SensorConfig): string {
  if (cfg.demo) {
    const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    return `${base}/api/mock-sensor`;
  }
  return cfg.endpoint.trim();
}

export async function fetchSensor(
  cfg: SensorConfig,
  timeoutMs = 4000,
): Promise<SensorReading> {
  const url = resolveFetchUrl(cfg);
  if (!url) throw new Error("No endpoint configured");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON from ESP32");
    }
    return normalizeReading(json);
  } finally {
    clearTimeout(t);
  }
}

// Derive the "control" base URL from the read endpoint. If the read URL is
// `http://host/data` we send commands to `http://host` (the ESP32 exposes
// `/brightness` at the root).
function deriveBaseUrl(readUrl: string): string {
  const trimmed = readUrl.trim().replace(/\/+$/, "");
  const lastSlash = trimmed.lastIndexOf("/");
  const protoEnd = trimmed.indexOf("://");
  if (lastSlash > protoEnd + 2) {
    return trimmed.slice(0, lastSlash);
  }
  return trimmed;
}

export async function setBrightness(
  cfg: SensorConfig,
  percent: number,
  timeoutMs = 3000,
): Promise<void> {
  // Demo mode: brightness writes are no-op (the mock endpoint is read-only).
  if (cfg.demo) return;

  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const base = deriveBaseUrl(cfg.endpoint);
  const url = `${base}/brightness?value=${pct}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(t);
  }
}
