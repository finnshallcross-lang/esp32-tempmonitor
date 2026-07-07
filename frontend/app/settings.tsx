import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEFAULT_ENDPOINT,
  DEFAULT_INTERVAL_MS,
  DEFAULT_SAMPLE_INTERVAL_MS,
  REFRESH_INTERVALS,
  SAMPLE_INTERVALS,
  loadConfig,
  saveConfig,
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
  error: "#FF3B30",
  border: "#292929",
};

// Basic URL validation (http/https, host+optional port+optional path).
function isValidUrl(u: string): boolean {
  const trimmed = u.trim();
  if (!trimmed) return false;
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [intervalMs, setIntervalMs] = useState<number>(DEFAULT_INTERVAL_MS);
  const [sampleIntervalMs, setSampleIntervalMs] = useState<number>(
    DEFAULT_SAMPLE_INTERVAL_MS,
  );
  const [demo, setDemo] = useState(false);
  const [urlError, setUrlError] = useState<string>("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    loadConfig().then((cfg) => {
      setEndpoint(cfg.endpoint);
      setIntervalMs(cfg.intervalMs);
      setSampleIntervalMs(cfg.sampleIntervalMs);
      setDemo(cfg.demo);
    });
  }, []);

  const onSave = async () => {
    if (!demo && !isValidUrl(endpoint)) {
      setUrlError("Enter a valid URL starting with http:// or https://");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setUrlError("");
    await saveConfig({
      endpoint: endpoint.trim(),
      intervalMs,
      demo,
      sampleIntervalMs,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedFlash(true);
    setTimeout(() => {
      setSavedFlash(false);
      router.back();
    }, 500);
  };

  const onSelectInterval = (ms: number) => {
    Haptics.selectionAsync();
    setIntervalMs(ms);
  };

  const onSelectSampleInterval = (ms: number) => {
    Haptics.selectionAsync();
    setSampleIntervalMs(ms);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="settings-screen">
      <View style={styles.headerBar}>
        <Pressable
          testID="settings-back-button"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="chevron-left" size={22} color={C.onSurface} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 120 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Endpoint */}
          <Text style={styles.sectionLabel}>ESP32 ENDPOINT</Text>
          <TextInput
            testID="endpoint-input"
            value={endpoint}
            onChangeText={setEndpoint}
            placeholder="http://192.168.1.50"
            placeholderTextColor={C.onSurfaceTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!demo}
            style={[
              styles.input,
              demo && { opacity: 0.5 },
              urlError ? { borderColor: C.error } : null,
            ]}
          />
          {urlError ? (
            <Text style={styles.inputError} testID="endpoint-input-error">
              {urlError}
            </Text>
          ) : (
            <Text style={styles.helpText}>
              The base URL of your ESP32 web server. The app performs a GET and
              expects JSON with keys temperature, humidity, brightness.
            </Text>
          )}

          {/* Refresh interval */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
            REFRESH INTERVAL
          </Text>
          <View style={styles.segment} testID="interval-segmented">
            {REFRESH_INTERVALS.map((opt) => {
              const active = opt.ms === intervalMs;
              return (
                <Pressable
                  key={opt.ms}
                  testID={`interval-option-${opt.label}`}
                  onPress={() => onSelectInterval(opt.ms)}
                  style={[
                    styles.segmentItem,
                    active && styles.segmentItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* History sample interval */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
            HISTORY SAMPLE INTERVAL
          </Text>
          <View style={styles.segment} testID="sample-interval-segmented">
            {SAMPLE_INTERVALS.map((opt) => {
              const active = opt.ms === sampleIntervalMs;
              return (
                <Pressable
                  key={opt.ms}
                  testID={`sample-interval-option-${opt.label.replace(" ", "")}`}
                  onPress={() => onSelectSampleInterval(opt.ms)}
                  style={[
                    styles.segmentItem,
                    active && styles.segmentItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helpText}>
            How often a point is added to the 30-day history graph. Shorter =
            more detail, more storage. Existing history is not deleted when
            this changes.
          </Text>

          {/* Demo toggle */}
          <View style={[styles.row, { marginTop: 24 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>Use demo data</Text>
              <Text style={styles.rowSubtitle}>
                Pulls simulated readings from the cloud so you can preview the UI
                when the ESP32 is not reachable.
              </Text>
            </View>
            <Switch
              testID="demo-mode-switch"
              value={demo}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setDemo(v);
              }}
              trackColor={{ false: C.surfaceTertiary, true: C.brand }}
              thumbColor="#FFFFFF"
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Pressable
            testID="save-settings-button"
            onPress={onSave}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>
              {savedFlash ? "Saved ✓" : "Save Settings"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  title: {
    color: C.onSurface,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: {
    color: C.onSurfaceTertiary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: C.onSurface,
    fontSize: 15,
  },
  inputError: {
    color: C.error,
    fontSize: 12,
    marginTop: 6,
  },
  helpText: {
    color: C.onSurfaceTertiary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  segmentItemActive: { backgroundColor: C.brand },
  segmentText: {
    color: C.onSurfaceSecondary,
    fontWeight: "600",
    fontSize: 14,
  },
  segmentTextActive: { color: "#FFFFFF" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
  },
  rowTitle: { color: C.onSurface, fontSize: 15, fontWeight: "600" },
  rowSubtitle: {
    color: C.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  saveBtn: {
    backgroundColor: C.brand,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
