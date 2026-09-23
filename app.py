"""
Stockholm Pulse - Mobility & Outdoor Fitness Analytics Platform
Flask Web Application & REST API
"""

import os
import sys
from flask import Flask, render_template, jsonify, request

# Add core to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from core.smhi_client import SMHIClient
from core.mobility_client import MobilityClient
from core.fitness_client import FitnessClient
from core.pulse_analytics import PulseAnalytics

app = Flask(__name__)

# Initialize singletons
smhi_client = SMHIClient()
mobility_client = MobilityClient()
fitness_client = FitnessClient()
analytics_engine = PulseAnalytics(smhi_client, mobility_client, fitness_client)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/summary")
def api_summary():
    """
    Returns citywide top-level KPIs.
    """
    weather = smhi_client.get_stockholm_weather()
    bike_total = mobility_client.get_citywide_daily_total()
    fitness_totals = fitness_client.get_citywide_totals()
    counters = mobility_client.get_all_counters()

    return jsonify({
        "status": "ok",
        "city": "Stockholm",
        "weather": weather.get("current", {}),
        "mobility": {
            "daily_bike_passages": bike_total,
            "counters_count": len(counters),
            "top_bridge": "Skanstullsbron",
            "top_bridge_daily": 13800
        },
        "fitness": fitness_totals
    })

@app.route("/api/mobility/counters")
def api_counters():
    """
    Returns bike counters optionally filtered by district.
    """
    district = request.args.get("district")
    counters = mobility_client.get_all_counters(district=district)
    return jsonify({
        "count": len(counters),
        "counters": counters
    })

@app.route("/api/mobility/timeline")
def api_mobility_timeline():
    """
    Returns 72-hour bicycle flow timeline correlated with SMHI weather.
    """
    weather = smhi_client.get_stockholm_weather()
    timeline = mobility_client.get_72h_timeline(weather.get("history", []))
    return jsonify({
        "count": len(timeline),
        "timeline": timeline
    })

@app.route("/api/mobility/rush-hour")
def api_rush_hour():
    """
    Returns 24-hour diurnal rush curve (00:00 to 23:00).
    """
    profile = mobility_client.get_hourly_rush_profile()
    return jsonify({
        "profile": profile
    })

@app.route("/api/mobility/leaderboard")
def api_mobility_leaderboard():
    """
    Returns top bicycle bridges by daily passage volume.
    """
    limit = request.args.get("limit", 10, type=int)
    top = mobility_client.get_top_counters(limit=limit)
    return jsonify({
        "status": "ok",
        "metric": "daily_passages",
        "metric_label": "Passager per vardagsdygn",
        "unit": "cyklister/dygn",
        "leaderboard": top
    })

@app.route("/api/fitness/gyms")
def api_gyms():
    """
    Returns outdoor gyms with filters for district, lighting, accessible, min stations.
    """
    district = request.args.get("district")
    lighting = request.args.get("lighting", "false").lower() == "true"
    accessible = request.args.get("accessible", "false").lower() == "true"
    min_stations = request.args.get("min_stations", type=int)

    gyms = fitness_client.get_all_gyms(
        district=district,
        lighting_only=lighting,
        accessible_only=accessible,
        min_stations=min_stations
    )
    return jsonify({
        "count": len(gyms),
        "gyms": gyms
    })

@app.route("/api/fitness/tracks")
def api_tracks():
    """
    Returns running tracks optionally filtered by district.
    """
    district = request.args.get("district")
    tracks = fitness_client.get_all_tracks(district=district)
    return jsonify({
        "count": len(tracks),
        "tracks": tracks
    })

@app.route("/api/fitness/districts")
def api_districts():
    """
    Returns district demographic and fitness summary.
    """
    districts = fitness_client.get_districts_summary()
    return jsonify(districts)

@app.route("/api/fitness/leaderboard")
def api_fitness_leaderboard():
    """
    Returns top outdoor gyms ranked by rating or stations.
    """
    metric = request.args.get("metric", "rating").lower()
    limit = request.args.get("limit", 10, type=int)
    top = fitness_client.get_top_gyms(metric=metric, limit=limit)
    return jsonify({
        "status": "ok",
        "metric": metric,
        "metric_label": "Betyg (1–5)" if metric == "rating" else "Antal stationer",
        "unit": "stjärnor" if metric == "rating" else "stationer",
        "leaderboard": top
    })

@app.route("/api/weather")
def api_weather():
    """
    Returns SMHI weather observations.
    """
    force = request.args.get("refresh", "false").lower() == "true"
    data = smhi_client.get_stockholm_weather(force_refresh=force)
    return jsonify(data)

@app.route("/api/analytics")
def api_analytics():
    """
    Computes statistical weather elasticity, rush hour peaks, and narrative data stories.
    """
    analytics = analytics_engine.compute_full_analytics()
    return jsonify(analytics)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"Starting Stockholm Pulse Analytics Platform on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
