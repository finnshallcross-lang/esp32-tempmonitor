import os
import pytest
import requests

BASE_URL = "https://wifi-sensor-dash.preview.emergentagent.com"


class TestBackendRoot:
    def test_root_message(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("message") == "ESP32 Sensor Dash backend up"


class TestMockSensor:
    def test_mock_sensor_returns_numeric_fields(self):
        r = requests.get(f"{BASE_URL}/api/mock-sensor", timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in ("temperature", "humidity", "brightness"):
            assert k in data, f"missing key {k}"
            assert isinstance(data[k], (int, float)), f"{k} not numeric: {data[k]}"

    def test_mock_sensor_no_time_keys(self):
        r = requests.get(f"{BASE_URL}/api/mock-sensor", timeout=10)
        data = r.json()
        for forbidden in ("time", "timestamp", "ts", "date"):
            assert forbidden not in data, f"unexpected time key: {forbidden}"

    def test_mock_sensor_ranges(self):
        r = requests.get(f"{BASE_URL}/api/mock-sensor", timeout=10)
        data = r.json()
        assert 20.0 <= data["temperature"] <= 28.0
        assert 35.0 <= data["humidity"] <= 65.0
        assert 120.0 <= data["brightness"] <= 850.0

    def test_mock_sensor_variability(self):
        vals = set()
        for _ in range(5):
            r = requests.get(f"{BASE_URL}/api/mock-sensor", timeout=10)
            vals.add(r.json()["temperature"])
        # Not strictly guaranteed, but random.uniform makes collision very unlikely
        assert len(vals) > 1, "mock-sensor values not varying"
