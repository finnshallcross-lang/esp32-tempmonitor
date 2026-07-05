import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEFAULT_ENDPOINT,
  DEFAULT_INTERVAL_MS,
  SensorConfig,
  SensorReading,
  fetchSensor,
  loadConfig,
  resolveFetchUrl,
} from "@/src/lib/sensor";

const C = {
  surface: "#0A0A0A",
  surfaceSecondary: "#141414",
  surfaceTertiary: "#1F1F1F",
  onSurface: "#F2F2F2",
  onSurfaceSecondary: "#A3A3A3",
  onSurfaceTertiary: "#8A8A8A",
  brand: "#FF4D00",
  brandTertiary: "rgba(255, 77, 0, 0.15)",
  success: "#00D084",
  error: "#FF3B30",
  border: "#292929",
};

const HERO_IMG = "https://images.unsplash.com/photo-1603715749723-240c88df18b1";

type Status = "idle" | "loading" | "connected" | "error";

function formatValue(v: number | null, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return v.toFixed(digits);
}

function formatTime(d: Date | null): string {
  if (!d) return "Never";
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [config, setConfig] = useState<SensorConfig>({
    endpoint: DEFAULT_ENDPOINT,
    intervalMs: DEFAULT_INTERVAL_MS,
    demo: false,
  });
  const [reading, setReading] = useState<SensorReading>({
    temperature: null,
    humidity: null,
    brightness: null,
  });
  const [status, setStatus] = useState<Status>("idle");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const configRef = useRef<SensorConfig>(config);
  configRef.current = config;

  const doFetch = useCallback(async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const data = await fetchSensor(configRef.current);
      setReading(data);
      setLastUpdated(new Date());
      setStatus("connected");
      setErrorMsg("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setStatus("error");
      setErrorMsg(msg);
    }
  }, []);

  // Load persisted config once, and refetch when we return from settings.
  const reloadConfig = useCallback(async () => {
    const cfg = await loadConfig();
    setConfig(cfg);
    configRef.current = cfg;
    doFetch(false);
  }, [doFetch]);

  // Reload persisted config every time the dashboard regains focus, so
  // changes made in the Settings screen apply immediately on return.
  useFocusEffect(
    useCallback(() => {
      reloadConfig();
    }, [reloadConfig]),
  );

  // Auto-refresh loop, restarts when interval changes.
  useEffect(() => {
    const id = setInterval(() => doFetch(true), config.intervalMs);
    return () => clearInterval(id);
  }, [config.intervalMs, doFetch]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await doFetch(true);
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [doFetch]);

  const openSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/settings");
  }, [router]);

  const statusColor =
    status === "connected"
      ? C.success
      : status === "error"
      ? C.error
      : C.onSurfaceTertiary;
  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "error"
      ? "Disconnected"
      : status === "loading"
      ? "Connecting…"
      : "Idle";

  const displayUrl = resolveFetchUrl(config) || "Not configured";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="dashboard-screen">
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.brandTag}>ESP32</Text>
          <Text style={styles.title}>Sensor Dash</Text>
        </View>
        <Pressable
          testID="open-settings-button"
          onPress={openSettings}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={12}
        >
          <Feather name="settings" size={20} color={C.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 96 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.brand}
            colors={[C.brand]}
            progressBackgroundColor={C.surfaceSecondary}
          />
        }
      >
        {/* Hero connection card */}
        <View style={styles.hero} testID="connection-hero-card">
          <Image
            source={{ uri: HERO_IMG }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          <LinearGradient
            colors={["rgba(10,10,10,0.35)", "rgba(10,10,10,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroContent}>
            <View style={styles.statusPill} testID="connection-status-pill">
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.heroEndpoint} numberOfLines={1} testID="endpoint-label">
              {config.demo ? "DEMO • " : ""}
              {displayUrl}
            </Text>
            <View style={styles.heroMetaRow}>
              <Feather name="clock" size={12} color={C.onSurfaceTertiary} />
              <Text style={styles.heroMetaText} testID="last-updated-label">
                Last updated {formatTime(lastUpdated)}
              </Text>
            </View>
            {status === "loading" && !lastUpdated ? (
              <ActivityIndicator
                color={C.brand}
                style={{ marginTop: 12, alignSelf: "flex-start" }}
              />
            ) : null}
          </View>
        </View>

        {/* Error banner */}
        {status === "error" ? (
          <View style={styles.errorBanner} testID="error-banner">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color={C.error}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Connection failed</Text>
              <Text style={styles.errorBody} numberOfLines={2}>
                {errorMsg || "Could not reach the ESP32."}
              </Text>
            </View>
            <Pressable
              testID="retry-button"
              onPress={() => doFetch(false)}
              style={({ pressed }) => [
                styles.retryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Metric cards */}
        <MetricCard
          testID="metric-temperature"
          iconName="thermometer"
          label="Temperature"
          value={formatValue(reading.temperature, 1)}
          unit="°C"
        />
        <MetricCard
          testID="metric-humidity"
          iconName="water-percent"
          label="Humidity"
          value={formatValue(reading.humidity, 1)}
          unit="%"
        />
        <MetricCard
          testID="metric-brightness"
          iconName="brightness-6"
          label="Screen Brightness"
          value={formatValue(reading.brightness, 0)}
          unit="lux"
        />

        <Text style={styles.footnote} testID="footnote">
          The ESP32 must be reachable on the same Wi-Fi as this device. Time
          data from the sensor is ignored.
        </Text>
      </ScrollView>

      {/* Floating settings FAB */}
      <Pressable
        testID="settings-fab"
        onPress={openSettings}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 20 },
          pressed && { transform: [{ scale: 0.96 }] },
        ]}
      >
        <Feather name="sliders" size={18} color="#FFFFFF" />
        <Text style={styles.fabText}>Settings</Text>
      </Pressable>
    </View>
  );
}

type MetricCardProps = {
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  unit: string;
  testID: string;
};

function MetricCard({ iconName, label, value, unit, testID }: MetricCardProps) {
  return (
    <View style={styles.metricCard} testID={testID}>
      <View style={styles.metricIconWrap}>
        <MaterialCommunityIcons name={iconName} size={22} color={C.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
        <View style={styles.metricValueRow}>
          <Text style={styles.metricValue} testID={`${testID}-value`}>
            {value}
          </Text>
          <Text style={styles.metricUnit}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandTag: {
    color: C.brand,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "600",
  },
  title: {
    color: C.onSurface,
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
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
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hero: {
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  heroContent: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  heroEndpoint: {
    color: C.onSurface,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaText: { color: C.onSurfaceTertiary, fontSize: 12 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,59,48,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.35)",
    marginBottom: 16,
  },
  errorTitle: { color: C.error, fontWeight: "600", fontSize: 13 },
  errorBody: { color: C.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.brand,
  },
  retryText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },
  metricCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: C.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: C.onSurfaceTertiary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  metricValue: {
    color: C.onSurface,
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  metricUnit: {
    color: C.onSurfaceSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  footnote: {
    color: C.onSurfaceTertiary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.brand,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
});
