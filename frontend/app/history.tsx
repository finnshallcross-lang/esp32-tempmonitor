import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import {
  HistoryPoint,
  RETENTION_MS,
  SAMPLE_INTERVAL_MS,
  clearHistory,
  getHistory,
} from "@/src/lib/history";

const C = {
  surface: "#0A0A0A",
  surfaceSecondary: "#141414",
  surfaceTertiary: "#1F1F1F",
  onSurface: "#F2F2F2",
  onSurfaceSecondary: "#A3A3A3",
  onSurfaceTertiary: "#8A8A8A",
  brand: "#FF4D00",
  border: "#292929",
  temp: "#FF4D00",
  hum: "#3EC6FF",
  bright: "#F5D742",
  error: "#FF3B30",
};

const METRICS = [
  { key: "temperature" as const, label: "Temp", unit: "°C", color: C.temp },
  { key: "humidity" as const, label: "Humidity", unit: "%", color: C.hum },
  { key: "brightness" as const, label: "Brightness", unit: "%", color: C.bright },
];

type MetricKey = (typeof METRICS)[number]["key"];

// Chart geometry (viewBox coordinates, resized by parent).
const CHART_W = 340;
const CHART_H = 220;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 28;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function fmtRangeLabel(days: number) {
  if (days === 1) return "24 hours";
  return `${days} days`;
}

function pointsToPath(
  points: HistoryPoint[],
  key: MetricKey,
  now: number,
  rangeMs: number,
  yMin: number,
  yMax: number,
): string {
  const xStart = now - rangeMs;
  const span = Math.max(1, yMax - yMin);
  let d = "";
  let started = false;
  for (const p of points) {
    const v = p[key];
    if (v === null || v === undefined) {
      started = false;
      continue;
    }
    const nx = (p.ts - xStart) / rangeMs;
    const ny = (v - yMin) / span;
    const x = PAD_L + nx * PLOT_W;
    const y = PAD_T + (1 - ny) * PLOT_H;
    d += (started ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
    started = true;
  }
  return d;
}

function computeBounds(points: HistoryPoint[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    for (const m of METRICS) {
      const v = p[m.key];
      if (v === null || v === undefined) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 100 };
  }
  const pad = Math.max(1, (max - min) * 0.1);
  return { min: Math.floor(min - pad), max: Math.ceil(max + pad) };
}

function formatTick(ts: number, rangeDays: number): string {
  const d = new Date(ts);
  if (rangeDays <= 1) {
    return `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [days, setDays] = useState<number>(7);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getHistory(days);
      if (!cancelled) {
        setPoints(p);
        setNow(Date.now());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  // Refresh every minute so the chart's "right edge" (now) advances smoothly
  // and any newly recorded points appear without user action.
  useEffect(() => {
    const id = setInterval(async () => {
      const p = await getHistory(days);
      setPoints(p);
      setNow(Date.now());
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [days]);

  const bounds = useMemo(() => computeBounds(points), [points]);
  const rangeMs = days * 24 * 60 * 60 * 1000;

  const xTicks = useMemo(() => {
    const ticks = 4;
    const arr: { x: number; ts: number }[] = [];
    for (let i = 0; i <= ticks; i++) {
      const ts = now - rangeMs + (rangeMs * i) / ticks;
      const x = PAD_L + (i / ticks) * PLOT_W;
      arr.push({ x, ts });
    }
    return arr;
  }, [now, rangeMs]);

  const yTicks = useMemo(() => {
    const ticks = 4;
    const arr: { y: number; value: number }[] = [];
    for (let i = 0; i <= ticks; i++) {
      const value = bounds.min + ((bounds.max - bounds.min) * i) / ticks;
      const y = PAD_T + (1 - i / ticks) * PLOT_H;
      arr.push({ y, value });
    }
    return arr;
  }, [bounds]);

  const oldestTs = points.length ? points[0].ts : null;
  const newestTs = points.length ? points[points.length - 1].ts : null;

  const onSliderChange = (v: number) => {
    const rounded = Math.round(v);
    if (rounded !== days) {
      Haptics.selectionAsync();
      setDays(rounded);
    }
  };

  const onClear = () => {
    Alert.alert(
      "Clear history?",
      "This removes all locally-stored readings. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearHistory();
            setPoints([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  return (
    <View
      style={[styles.root, { paddingTop: insets.top }]}
      testID="history-screen"
    >
      <View style={styles.headerBar}>
        <Pressable
          testID="history-back-button"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="chevron-left" size={22} color={C.onSurface} />
        </Pressable>
        <View>
          <Text style={styles.brandTag}>HISTORY</Text>
          <Text style={styles.title}>{fmtRangeLabel(days)}</Text>
        </View>
        <Pressable
          testID="history-clear-button"
          onPress={onClear}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="trash-2" size={18} color={C.onSurfaceSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Legend */}
        <View style={styles.legendRow} testID="history-legend">
          {METRICS.map((m) => (
            <View key={m.key} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: m.color }]}
              />
              <Text style={styles.legendText}>
                {m.label} ({m.unit})
              </Text>
            </View>
          ))}
        </View>

        {/* Chart card */}
        <View style={styles.chartCard} testID="history-chart-card">
          <Svg
            width="100%"
            height={CHART_H}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            testID="history-chart-svg"
          >
            {/* Y grid + labels */}
            {yTicks.map((t, i) => (
              <Line
                key={`yg-${i}`}
                x1={PAD_L}
                x2={PAD_L + PLOT_W}
                y1={t.y}
                y2={t.y}
                stroke={C.surfaceTertiary}
                strokeWidth={1}
              />
            ))}
            {yTicks.map((t, i) => (
              <SvgText
                key={`yl-${i}`}
                x={PAD_L - 6}
                y={t.y + 3}
                fontSize={9}
                fill={C.onSurfaceTertiary}
                textAnchor="end"
              >
                {Math.round(t.value)}
              </SvgText>
            ))}
            {/* X labels */}
            {xTicks.map((t, i) => (
              <SvgText
                key={`xl-${i}`}
                x={t.x}
                y={CHART_H - 8}
                fontSize={9}
                fill={C.onSurfaceTertiary}
                textAnchor="middle"
              >
                {formatTick(t.ts, days)}
              </SvgText>
            ))}
            {/* Lines */}
            {METRICS.map((m) => {
              const d = pointsToPath(
                points,
                m.key,
                now,
                rangeMs,
                bounds.min,
                bounds.max,
              );
              if (!d) return null;
              return (
                <Path
                  key={m.key}
                  d={d}
                  stroke={m.color}
                  strokeWidth={1.5}
                  fill="none"
                />
              );
            })}
            {/* Data-point markers for the latest sample of each metric */}
            {METRICS.map((m) => {
              for (let i = points.length - 1; i >= 0; i--) {
                const v = points[i][m.key];
                if (v === null || v === undefined) continue;
                const span = Math.max(1, bounds.max - bounds.min);
                const nx = (points[i].ts - (now - rangeMs)) / rangeMs;
                const ny = (v - bounds.min) / span;
                const x = PAD_L + nx * PLOT_W;
                const y = PAD_T + (1 - ny) * PLOT_H;
                return (
                  <Circle
                    key={m.key}
                    cx={x}
                    cy={y}
                    r={2.5}
                    fill={m.color}
                  />
                );
              }
              return null;
            })}
          </Svg>

          {points.length === 0 ? (
            <Text style={styles.emptyText} testID="history-empty">
              No samples yet. The app records one point every 15 minutes while
              connected — leave it running to build history.
            </Text>
          ) : null}
        </View>

        {/* Range slider */}
        <View style={styles.sliderCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionLabel}>RESOLUTION</Text>
            <Text style={styles.sliderValueText} testID="history-range-label">
              {fmtRangeLabel(days)}
            </Text>
          </View>
          <Slider
            testID="history-range-slider"
            style={styles.slider}
            minimumValue={1}
            maximumValue={30}
            step={1}
            value={days}
            minimumTrackTintColor={C.brand}
            maximumTrackTintColor={C.surfaceTertiary}
            thumbTintColor={C.brand}
            onValueChange={onSliderChange}
          />
          <View style={styles.footRow}>
            <Text style={styles.hint}>1 day</Text>
            <Text style={styles.hint}>30 days</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard} testID="history-stats">
          <StatRow
            label="Samples in range"
            value={points.length.toString()}
          />
          <StatRow
            label="Sample interval"
            value={`${Math.round(SAMPLE_INTERVAL_MS / 60000)} min`}
          />
          <StatRow
            label="Retention"
            value={`${Math.round(RETENTION_MS / (24 * 3600 * 1000))} days`}
          />
          <StatRow
            label="Oldest"
            value={oldestTs ? new Date(oldestTs).toLocaleString() : "—"}
          />
          <StatRow
            label="Newest"
            value={newestTs ? new Date(newestTs).toLocaleString() : "—"}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTag: {
    color: C.brand,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "600",
    textAlign: "center",
  },
  title: {
    color: C.onSurface,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: C.onSurfaceSecondary, fontSize: 12, fontWeight: "500" },
  chartCard: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  emptyText: {
    color: C.onSurfaceTertiary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sliderCard: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionLabel: {
    color: C.onSurfaceTertiary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  sliderValueText: {
    color: C.onSurface,
    fontSize: 16,
    fontWeight: "600",
  },
  slider: { width: "100%", height: 40 },
  footRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: -4,
  },
  hint: { color: C.onSurfaceTertiary, fontSize: 11 },
  statsCard: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  statLabel: { color: C.onSurfaceTertiary, fontSize: 12 },
  statValue: { color: C.onSurface, fontSize: 13, fontWeight: "500" },
});
