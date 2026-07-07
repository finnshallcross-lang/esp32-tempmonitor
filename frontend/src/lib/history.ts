// Local history storage for ESP32 sensor readings.
// One sample every 15 minutes, rolling 30-day retention.

import { storage } from "@/src/utils/storage";

import type { SensorReading } from "./sensor";

const KEY = "esp32.history.v1";
export const SAMPLE_INTERVAL_MS = 15 * 60 * 1000;   // 15 min
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

export type HistoryPoint = {
  ts: number;                    // ms epoch, generated locally
  temperature: number | null;
  humidity: number | null;
  brightness: number | null;
};

// AsyncStorage's JSON path only serializes primitives; we encode the array
// ourselves so we don't accidentally hit the value-type guard in `storage`.
async function readAll(): Promise<HistoryPoint[]> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryPoint[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(points: HistoryPoint[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(points));
}

function prune(points: HistoryPoint[], now: number): HistoryPoint[] {
  const cutoff = now - RETENTION_MS;
  return points.filter((p) => p.ts >= cutoff);
}

// Record a reading if enough time has elapsed since the last sample.
// Returns the point that was stored, or null if the write was skipped.
// Callers must only invoke this after a *successful* live fetch from the
// real ESP32 – demo/mock data must be filtered out at the call site so it
// never pollutes real history.
export async function recordReadingIfDue(
  reading: SensorReading,
  now: number = Date.now(),
): Promise<HistoryPoint | null> {
  // Guard: refuse to record an empty reading (all three fields missing).
  // This happens if the ESP32 responded but no sensor keys matched.
  if (
    reading.temperature === null &&
    reading.humidity === null &&
    reading.brightness === null
  ) {
    return null;
  }
  const existing = await readAll();
  const last = existing[existing.length - 1];
  if (last && now - last.ts < SAMPLE_INTERVAL_MS) {
    return null;
  }
  const point: HistoryPoint = {
    ts: now,
    temperature: reading.temperature,
    humidity: reading.humidity,
    brightness: reading.brightness,
  };
  const pruned = prune([...existing, point], now);
  await writeAll(pruned);
  return point;
}

export async function getHistory(
  rangeDays: number,
  now: number = Date.now(),
): Promise<HistoryPoint[]> {
  const all = await readAll();
  const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;
  return all.filter((p) => p.ts >= cutoff);
}

export async function clearHistory(): Promise<void> {
  await writeAll([]);
}
