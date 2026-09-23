"""
Mobility Client for Stockholm Pulse
Manages bicycle counter stations, passage timelines, and rush-hour dynamics.
"""

import json
import os
import math

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

class MobilityClient:
    def __init__(self):
        counters_file = os.path.join(DATA_DIR, "bike_counters.json")
        with open(counters_file, "r", encoding="utf-8") as f:
            self.counters = json.load(f)

    def get_all_counters(self, district=None):
        if district and district.lower() != "all":
            return [c for c in self.counters if c["district"].lower() == district.lower()]
        return self.counters

    def get_counter(self, counter_id):
        for c in self.counters:
            if c["id"].lower() == counter_id.lower():
                return c
        return None

    def get_top_counters(self, limit=10):
        sorted_counters = sorted(self.counters, key=lambda c: c["daily_avg"], reverse=True)
        results = []
        for rank, c in enumerate(sorted_counters[:limit], 1):
            item = dict(c)
            item["rank"] = rank
            results.append(item)
        return results

    def get_citywide_daily_total(self):
        return sum(c["daily_avg"] for c in self.counters)

    def get_hourly_rush_profile(self):
        """
        Returns average hourly distribution of bicycle traffic across a normal weekday (00:00 to 23:00).
        Reflects Stockholm's distinct morning (07:30-08:45) and afternoon (16:30-17:45) commute peaks.
        """
        # Hourly percentage weights of total daily volume
        weights = [
            0.4, 0.2, 0.1, 0.2, 0.5, 1.8, 4.5, 11.2, 13.5, 6.4,
            4.2, 4.5, 4.8, 4.5, 4.9, 7.8, 13.8, 12.2, 5.8, 3.8,
            2.5, 1.8, 1.2, 0.7
        ]
        
        profile = []
        city_total = self.get_citywide_daily_total()
        for hour in range(24):
            pct = weights[hour]
            volume = int(city_total * (pct / 100.0))
            is_peak = (hour in [7, 8, 16, 17])
            profile.append({
                "hour": f"{hour:02d}:00",
                "hour_num": hour,
                "share_pct": round(pct, 1),
                "citywide_passages": volume,
                "is_peak": is_peak,
                "traffic_type": "Morgonrusning" if hour in [7, 8] else ("Eftermiddagsrusning" if hour in [16, 17] else ("Dagtid" if 9 <= hour <= 15 else "Natt / Sen kväll"))
            })
        return profile

    def get_72h_timeline(self, weather_history):
        """
        Calculates 72-hour historical passages correlated with SMHI weather conditions.
        Applies rain reduction (elasticity) and temperature impact.
        """
        city_total = self.get_citywide_daily_total()
        weights = [
            0.4, 0.2, 0.1, 0.2, 0.5, 1.8, 4.5, 11.2, 13.5, 6.4,
            4.2, 4.5, 4.8, 4.5, 4.9, 7.8, 13.8, 12.2, 5.8, 3.8,
            2.5, 1.8, 1.2, 0.7
        ]

        timeline = []
        for item in weather_history:
            hour = item.get("hour", 12)
            rain = item.get("rain_mm", 0.0)
            temp = item.get("temperature_c", 13.0)

            base_volume = (city_total / 24.0) * (weights[hour] / (100.0 / 24.0))

            # Rain factor: -7.2% per mm rain
            rain_factor = max(0.35, 1.0 - (rain * 0.072))
            
            # Temp factor: -2.5% per degree below 12C
            temp_diff = 12.0 - temp
            temp_factor = max(0.5, 1.0 - (max(0, temp_diff) * 0.025))

            actual_volume = int(base_volume * rain_factor * temp_factor)

            timeline.append({
                "time_iso": item.get("time_iso"),
                "hour": hour,
                "base_volume": int(base_volume),
                "actual_volume": actual_volume,
                "reduction_pct": round((1.0 - (actual_volume / max(1, base_volume))) * 100, 1),
                "rain_mm": rain,
                "temp_c": temp
            })

        return timeline
