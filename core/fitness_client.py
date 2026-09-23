"""
Fitness Client for Stockholm Pulse
Manages outdoor gyms, illuminated running tracks, and district fitness density.
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

class FitnessClient:
    def __init__(self):
        with open(os.path.join(DATA_DIR, "outdoor_gyms.json"), "r", encoding="utf-8") as f:
            self.gyms = json.load(f)

        with open(os.path.join(DATA_DIR, "running_tracks.json"), "r", encoding="utf-8") as f:
            self.tracks = json.load(f)

        with open(os.path.join(DATA_DIR, "districts.json"), "r", encoding="utf-8") as f:
            self.districts = json.load(f)

    def get_all_gyms(self, district=None, lighting_only=False, accessible_only=False, min_stations=None):
        results = self.gyms
        if district and district.lower() != "all":
            results = [g for g in results if g["district"].lower() == district.lower()]

        if lighting_only:
            results = [g for g in results if g.get("lighting") is True]

        if accessible_only:
            results = [g for g in results if g.get("accessible") is True]

        if min_stations:
            results = [g for g in results if g.get("stations_count", 0) >= min_stations]

        return results

    def get_gym(self, gym_id):
        for g in self.gyms:
            if g["id"].lower() == gym_id.lower():
                return g
        return None

    def get_all_tracks(self, district=None):
        if district and district.lower() != "all":
            return [t for t in self.tracks if district.lower() in t["district"].lower()]
        return self.tracks

    def get_top_gyms(self, metric="rating", limit=10):
        """
        Ranks top outdoor gyms by 'rating' or 'stations' (equipment count).
        """
        if metric == "stations":
            sorted_gyms = sorted(self.gyms, key=lambda g: (g.get("stations_count", 0), g.get("rating", 0)), reverse=True)
        else:
            sorted_gyms = sorted(self.gyms, key=lambda g: (g.get("rating", 0), g.get("stations_count", 0)), reverse=True)

        results = []
        for rank, g in enumerate(sorted_gyms[:limit], 1):
            item = dict(g)
            item["rank"] = rank
            results.append(item)
        return results

    def get_districts_summary(self):
        return self.districts

    def get_citywide_totals(self):
        total_gyms = len(self.gyms)
        total_stations = sum(g.get("stations_count", 0) for g in self.gyms)
        lighted_gyms = sum(1 for g in self.gyms if g.get("lighting"))
        total_tracks_km = sum(t.get("length_km", 0) for t in self.tracks)

        return {
            "total_outdoor_gyms": total_gyms,
            "total_workout_stations": total_stations,
            "illuminated_gyms_count": lighted_gyms,
            "illuminated_pct": round((lighted_gyms / total_gyms) * 100, 1) if total_gyms else 0,
            "total_running_tracks": len(self.tracks),
            "total_track_distance_km": round(total_tracks_km, 1)
        }
