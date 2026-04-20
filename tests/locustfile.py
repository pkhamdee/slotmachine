"""
Locust performance test for the Slot Machine API.

Run headlessly in CI:
  locust -f tests/locustfile.py --headless --users 20 --spawn-rate 5 \
         --run-time 60s --host http://localhost:3001

Environment variables:
  ADMIN_PASSWORD  Admin password (default: admin1234)
"""

import os
import time
import uuid

import requests
import urllib3
from locust import HttpUser, between, events, task

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin1234")

_admin_token: str | None = None


# ---------------------------------------------------------------------------
# Session bootstrap — runs once before the load test starts
# ---------------------------------------------------------------------------

@events.test_start.add_listener
def bootstrap_session(environment, **kwargs):
    """Log in as admin and start a session so spin endpoints are available."""
    global _admin_token
    host = environment.host

    try:
        resp = requests.post(
            f"{host}/api/admin/login",
            json={"password": ADMIN_PASSWORD},
            timeout=10,
        )
        if resp.status_code != 200:
            print(f"[locust] Admin login failed: {resp.status_code} {resp.text}")
            return

        _admin_token = resp.json().get("token")
        print("[locust] Admin login OK")

        nr = requests.post(
            f"{host}/api/admin/next-round",
            headers={"Authorization": f"Bearer {_admin_token}"},
            timeout=10,
        )
        print(f"[locust] next-round: {nr.status_code}")

        # Wait for lobby to transition to active (LOBBY_DURATION + small buffer)
        print("[locust] Waiting for session to become active …")
        time.sleep(5)

    except Exception as exc:  # noqa: BLE001
        print(f"[locust] bootstrap_session error: {exc}")


# ---------------------------------------------------------------------------
# User behaviour
# ---------------------------------------------------------------------------

class SlotMachineUser(HttpUser):
    """Simulates a registered player spinning reels and checking state."""

    wait_time = between(0.5, 2)

    def on_start(self):
        """Register a unique player at the start of each simulated user."""
        self.player_id = None
        self.balance = 0

        name = f"perf_{uuid.uuid4().hex[:8]}"
        with self.client.post(
            "/api/players",
            json={"name": name},
            name="/api/players [register]",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.player_id = data.get("playerId")
                self.balance = data.get("balance", 1000)
                resp.success()
            else:
                resp.failure(f"Registration failed: {resp.status_code}")

    # ------------------------------------------------------------------
    # Tasks (weighted by relative frequency)
    # ------------------------------------------------------------------

    @task(5)
    def spin(self):
        """Spin the reels — the hottest endpoint."""
        if not self.player_id or self.balance < 10:
            return

        with self.client.post(
            f"/api/players/{self.player_id}/spin",
            json={"bet": 10},
            name="/api/players/[id]/spin",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.balance = resp.json().get("balanceAfter", self.balance)
                resp.success()
            elif resp.status_code == 403:
                # Session not active — not an error, just skip
                resp.success()
            else:
                resp.failure(f"Spin failed: {resp.status_code} {resp.text[:120]}")

    @task(2)
    def get_session_state(self):
        self.client.get("/api/sessions/current", name="/api/sessions/current")

    @task(1)
    def get_player(self):
        if self.player_id:
            self.client.get(
                f"/api/players/{self.player_id}",
                name="/api/players/[id]",
            )

    @task(1)
    def get_hall_of_fame(self):
        self.client.get("/api/hall-of-fame", name="/api/hall-of-fame")
