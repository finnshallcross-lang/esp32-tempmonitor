// Shared config keys, defaults, and sensor fetch helper.

import { storage } from "@/src/utils/storage";

export const CONFIG_KEYS = {
  endpoint: "esp32.endpoint",
  interval: "esp32.interval",
  demo: "esp32.demo",
} as const;

export const DEFAULT_ENDPOINT = "http://192.168.68.71";
export const DEFAULT_INTERVAL_MS = 5000;
export const REFRESH_INTERVALS = [
  { label: "2s", ms: 2000 },
  { label: "5s", ms: 5000 },
  { label: "10s", ms: 10000 },
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
};

export async function loadConfig(): Promise<SensorConfig> {
  const [endpoint, interval, demo] = await Promise.all([
    storage.getItem(CONFIG_KEYS.endpoint, DEFAULT_ENDPOINT),
    storage.getItem(CONFIG_KEYS.interval, DEFAULT_INTERVAL_MS),
    storage.getItem(CONFIG_KEYS.demo, false),
  ]);
  return {
    endpoint: (endpoint as string) || DEFAULT_ENDPOINT,
    intervalMs: (interval as number) || DEFAULT_INTERVAL_MS,
    demo: Boolean(demo),
  };
}

export async function saveConfig(cfg: SensorConfig): Promise<void> {
  await Promise.all([
    storage.setItem(CONFIG_KEYS.endpoint, cfg.endpoint),
    storage.setItem(CONFIG_KEYS.interval, cfg.intervalMs),
    storage.setItem(CONFIG_KEYS.demo, cfg.demo),
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
