"""
Unit & Integration Tests for Stockholm Pulse Analytics Platform
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.smhi_client import SMHIClient
from core.mobility_client import MobilityClient
from core.fitness_client import FitnessClient
from core.pulse_analytics import PulseAnalytics
from app import app

class TestStockholmPulse(unittest.TestCase):
    def setUp(self):
        self.smhi = SMHIClient()
        self.mobility = MobilityClient()
        self.fitness = FitnessClient()
        self.analytics = PulseAnalytics(self.smhi, self.mobility, self.fitness)
        self.client = app.test_client()

    def test_smhi_client(self):
        w = self.smhi.get_stockholm_weather()
        self.assertIn("current", w)
        self.assertIn("history", w)
        self.assertGreaterEqual(len(w["history"]), 12)
        curr = w["current"]
        self.assertIn("temperature_c", curr)
        self.assertIn("wind_speed_ms", curr)
        self.assertIn("rain_1h_mm", curr)

    def test_mobility_client(self):
        counters = self.mobility.get_all_counters()
        self.assertGreaterEqual(len(counters), 10, "Should have at least 10 bike counters")
        
        c = counters[0]
        self.assertIn("name", c)
        self.assertIn("lat", c)
        self.assertIn("lon", c)
        self.assertIn("daily_avg", c)

        # Skanstullsbron should be in counters
        names = [x["name"] for x in counters]
        self.assertTrue(any("Skanstull" in n for n in names))

        # Rush hour profile
        profile = self.mobility.get_hourly_rush_profile()
        self.assertEqual(len(profile), 24)
        peak_am = next(p for p in profile if p["hour"] == "08:00")
        self.assertTrue(peak_am["is_peak"])

        # Timeline
        w = self.smhi.get_stockholm_weather()
        timeline = self.mobility.get_72h_timeline(w["history"])
        self.assertEqual(len(timeline), len(w["history"]))

    def test_fitness_client(self):
        gyms = self.fitness.get_all_gyms()
        self.assertGreaterEqual(len(gyms), 15, "Should have at least 15 outdoor gyms")

        g = gyms[0]
        self.assertIn("name", g)
        self.assertIn("material", g)
        self.assertIn("rating", g)
        self.assertIn("stations_count", g)

        # Filter by lighting
        lighted = self.fitness.get_all_gyms(lighting_only=True)
        self.assertGreater(len(lighted), 0)
        self.assertTrue(all(x["lighting"] is True for x in lighted))

        # Running tracks
        tracks = self.fitness.get_all_tracks()
        self.assertGreaterEqual(len(tracks), 5)
        self.assertIn("length_km", tracks[0])

        # Districts
        districts = self.fitness.get_districts_summary()
        self.assertIn("Södermalm", districts)
        self.assertIn("Kungsholmen", districts)

    def test_pulse_analytics(self):
        analysis = self.analytics.compute_full_analytics()
        self.assertIn("correlations", analysis)
        self.assertIn("rush_hour_analysis", analysis)
        self.assertIn("district_rankings", analysis)
        self.assertIn("narrative_insights", analysis)

        # Correlation bounds
        r_rain = analysis["correlations"]["rain_vs_reduction"]["r"]
        self.assertTrue(-1.0 <= r_rain <= 1.0)

        # Narrative stories count
        stories = analysis["narrative_insights"]
        self.assertGreaterEqual(len(stories), 3)

    def test_flask_api_endpoints(self):
        # 1. Summary
        res_sum = self.client.get("/api/summary")
        self.assertEqual(res_sum.status_code, 200)
        data_sum = res_sum.get_json()
        self.assertEqual(data_sum["city"], "Stockholm")
        self.assertIn("mobility", data_sum)
        self.assertIn("fitness", data_sum)

        # 2. Counters
        res_counters = self.client.get("/api/mobility/counters")
        self.assertEqual(res_counters.status_code, 200)
        self.assertGreaterEqual(res_counters.get_json()["count"], 10)

        # 3. Gyms
        res_gyms = self.client.get("/api/fitness/gyms")
        self.assertEqual(res_gyms.status_code, 200)
        self.assertGreaterEqual(res_gyms.get_json()["count"], 15)

        # 4. Tracks
        res_tracks = self.client.get("/api/fitness/tracks")
        self.assertEqual(res_tracks.status_code, 200)

        # 5. Leaderboard
        res_lead = self.client.get("/api/mobility/leaderboard?limit=5")
        self.assertEqual(res_lead.status_code, 200)
        self.assertEqual(len(res_lead.get_json()["leaderboard"]), 5)

        # 6. Analytics
        res_ana = self.client.get("/api/analytics")
        self.assertEqual(res_ana.status_code, 200)

        # 7. Index HTML
        res_index = self.client.get("/")
        self.assertEqual(res_index.status_code, 200)

if __name__ == "__main__":
    unittest.main()
