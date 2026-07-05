# ESP32 Sensor Dash — PRD

## Overview
A single-purpose mobile dashboard that displays live temperature, humidity, and screen-brightness readings from an ESP32 microcontroller reachable over the user's local Wi-Fi via HTTP. Time data from the ESP32 is intentionally ignored; the "Last updated" timestamp is generated locally.

## User Choices Confirmed
- Transport: HTTP GET, JSON response.
- Default ESP32 endpoint: `http://192.168.68.71`.
- JSON keys expected: `temperature`, `humidity`, `brightness` (aliases like `temp`/`hum`/`light`/`lux` are also tolerated).
- Scope: live readings only. No history, no alerts, no push.
- Testing: user will validate the real ESP32 on the same Wi-Fi as their phone (cloud preview cannot reach a private LAN device).

## Screens
1. **Dashboard** (`app/index.tsx`)
   - Hero connection card (matte texture image + gradient scrim) with status pill (Connected / Disconnected / Connecting / Idle), endpoint label, and locally-generated "Last updated" time.
   - Three metric cards: Temperature (°C, 1 dp), Humidity (%, 1 dp), Screen Brightness (lux, 0 dp).
   - Inline error banner + Retry when the fetch fails.
   - Manual pull-to-refresh (haptic feedback).
   - Floating "Settings" FAB.
   - `useFocusEffect` reloads persisted config every time the screen regains focus.
2. **Settings** (`app/settings.tsx`)
   - Endpoint URL input (with `http://` / `https://` validation).
   - Segmented refresh interval: 2s / 5s / 10s.
   - "Use demo data" switch — when ON, the app fetches from the built-in backend mock endpoint so the UI can be previewed without a real ESP32.
   - Sticky "Save Settings" button, keyboard-aware.
   - All values persisted with AsyncStorage (via existing `@/src/utils/storage` helper).

## Backend
- `GET /api/` — health message.
- `GET /api/mock-sensor` — returns randomized `{temperature, humidity, brightness}` for the in-app demo switch. **MOCKED** endpoint, used only for cloud-preview validation.

## Design
Follows `/app/design_guidelines.json` — Dark-First Utility personality, Ember/Signal Orange (`#FF4D00`) brand, no glass/blur, no shadows on cards, single-column full-width metric cards.

## Non-Goals
- Charts / historical storage.
- Threshold alerts / notifications.
- Auth (single-user, LAN-only device).

## Business Enhancement (future)
Adding an optional "Share snapshot" button that renders a shareable PNG of the current readings would boost organic distribution among makers/hobbyists on Discord and Reddit at near-zero build cost.
