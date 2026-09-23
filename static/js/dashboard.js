/**
 * Stockholm Pulse - Interactive Dashboard & Analytics Logic
 */

// Global Application State
const AppState = {
    selectedDistrict: 'all',
    layers: {
        bikes: true,
        gyms: true,
        tracks: true
    },
    gymFilters: {
        lightingOnly: false,
        accessibleOnly: false
    },
    activeLeaderboardTab: 'bikes',
    data: {
        counters: [],
        gyms: [],
        tracks: [],
        districts: [],
        weather: null,
        analytics: null
    },
    map: null,
    layerGroups: {
        bikes: null,
        gyms: null,
        tracks: null
    },
    markers: {
        bikes: {},
        gyms: {},
        tracks: {}
    },
    charts: {
        timeline: null,
        rushHour: null,
        districtBar: null
    }
};

// SVG Icon definitions
const ICONS = {
    bike: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
    gym: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12"/></svg>`,
    track: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m4 15 4-4 4 4 8-8"/><path d="M16 7h4v4"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initMap();
    initEventHandlers();
    loadDashboardData();
});

// Digital Clock
function initClock() {
    const clockEl = document.getElementById('clockVal');
    function updateClock() {
        const now = new Date();
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// Leaflet Map Initialization
function initMap() {
    const stockholmCenter = [59.3293, 18.0686];
    const defaultZoom = 12;

    AppState.map = L.map('map', {
        center: stockholmCenter,
        zoom: defaultZoom,
        zoomControl: true,
        scrollWheelZoom: true
    });

    // Dark Tile Layer (Esri World Dark Gray Canvas)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; DeLorme, NAVTEQ',
        maxZoom: 17,
        minZoom: 10
    }).addTo(AppState.map);

    AppState.layerGroups.bikes = L.layerGroup().addTo(AppState.map);
    AppState.layerGroups.gyms = L.layerGroup().addTo(AppState.map);
    AppState.layerGroups.tracks = L.layerGroup().addTo(AppState.map);

    // Reset button
    const btnReset = document.getElementById('btnResetMap');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            AppState.map.setView(stockholmCenter, defaultZoom, { animate: true });
        });
    }
}

// Event Listeners for Filters & Leaderboard Tabs
function initEventHandlers() {
    // District Filter Buttons
    const districtButtons = document.querySelectorAll('#districtFilters .filter-btn');
    districtButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            districtButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.selectedDistrict = btn.getAttribute('data-district');
            applyFilters();
        });
    });

    // Layer Toggles
    const layerButtons = document.querySelectorAll('#layerToggles .layer-btn');
    layerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const layerKey = btn.getAttribute('data-layer');
            AppState.layers[layerKey] = !AppState.layers[layerKey];
            
            if (AppState.layers[layerKey]) {
                btn.classList.add('active');
                AppState.map.addLayer(AppState.layerGroups[layerKey]);
            } else {
                btn.classList.remove('active');
                AppState.map.removeLayer(AppState.layerGroups[layerKey]);
            }
            updateActiveCounts();
        });
    });

    // Checkboxes
    const chkLighting = document.getElementById('chkLightingOnly');
    if (chkLighting) {
        chkLighting.addEventListener('change', (e) => {
            AppState.gymFilters.lightingOnly = e.target.checked;
            applyFilters();
        });
    }

    const chkAccessible = document.getElementById('chkAccessibleOnly');
    if (chkAccessible) {
        chkAccessible.addEventListener('change', (e) => {
            AppState.gymFilters.accessibleOnly = e.target.checked;
            applyFilters();
        });
    }

    // Leaderboard Tabs
    const tabButtons = document.querySelectorAll('#leaderboardTabs .tab-btn');
    tabButtons.forEach(tab => {
        tab.addEventListener('click', () => {
            tabButtons.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            AppState.activeLeaderboardTab = tab.getAttribute('data-tab');
            renderLeaderboard();
        });
    });
}

// Core Data Loader
async function loadDashboardData() {
    try {
        const [summaryRes, countersRes, gymsRes, tracksRes, timelineRes, rushHourRes, districtsRes, analyticsRes] = 
            await Promise.all([
                fetch('/api/summary').then(r => r.json()),
                fetch('/api/mobility/counters').then(r => r.json()),
                fetch('/api/fitness/gyms').then(r => r.json()),
                fetch('/api/fitness/tracks').then(r => r.json()),
                fetch('/api/mobility/timeline').then(r => r.json()),
                fetch('/api/mobility/rush-hour').then(r => r.json()),
                fetch('/api/fitness/districts').then(r => r.json()),
                fetch('/api/analytics').then(r => r.json())
            ]);

        AppState.data.counters = countersRes.counters || [];
        AppState.data.gyms = gymsRes.gyms || [];
        AppState.data.tracks = tracksRes.tracks || [];
        AppState.data.districts = districtsRes || [];
        AppState.data.weather = summaryRes.weather || {};
        AppState.data.analytics = analyticsRes || {};

        // Render sections
        renderSummaryKPIs(summaryRes, analyticsRes);
        renderMapMarkers();
        renderLeaderboard();
        renderInsightsFeed(analyticsRes);
        renderCountersTable(AppState.data.counters);
        
        // Render Charts
        renderTimelineChart(timelineRes.timeline || [], analyticsRes);
        renderRushHourChart(rushHourRes.profile || []);
        renderDistrictBarChart(districtsRes);

        updateActiveCounts();

    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }
}

// Render Summary KPIs
function renderSummaryKPIs(summary, analytics) {
    const weather = summary.weather || {};
    const mobility = summary.mobility || {};
    const fitness = summary.fitness || {};

    const elBikeTotal = document.getElementById('kpiBikeTotal');
    if (elBikeTotal && mobility.daily_bike_passages) {
        elBikeTotal.textContent = Number(mobility.daily_bike_passages).toLocaleString('sv-SE');
    }

    const elTopBridge = document.getElementById('kpiTopBridge');
    if (elTopBridge && mobility.top_bridge) {
        elTopBridge.textContent = mobility.top_bridge;
    }

    const elTempVal = document.getElementById('kpiTempVal');
    if (elTempVal && weather.temperature_c !== undefined) {
        elTempVal.textContent = `${weather.temperature_c.toFixed(1)}°C`;
    }

    const elRainDesc = document.getElementById('kpiRainDesc');
    if (elRainDesc && weather.precipitation_mm_1h !== undefined) {
        const rain = weather.precipitation_mm_1h;
        elRainDesc.textContent = rain > 0 
            ? `${rain.toFixed(1)} mm nederbörd senaste timmen` 
            : `Uppehållsväder (0.0 mm nederbörd)`;
    }

    const elWindVal = document.getElementById('kpiWindVal');
    if (elWindVal && weather.wind_speed_ms !== undefined) {
        elWindVal.textContent = `${weather.wind_speed_ms.toFixed(1)} m/s`;
    }

    const elElasticityVal = document.getElementById('kpiElasticityVal');
    if (elElasticityVal && analytics.weather_elasticity) {
        elElasticityVal.textContent = `-${Math.abs(analytics.weather_elasticity.elasticity_pct_per_mm).toFixed(1)} %`;
    }

    const elGymsVal = document.getElementById('kpiGymsVal');
    if (elGymsVal && fitness.total_gyms) {
        elGymsVal.textContent = `${fitness.total_gyms} utegym`;
    }

    const elLightedGyms = document.getElementById('kpiLightedGyms');
    if (elLightedGyms && fitness.lighting_coverage_pct) {
        elLightedGyms.textContent = `${Math.round(fitness.lighting_coverage_pct)} %`;
    }

    const elSmhiStation = document.getElementById('smhiStation');
    if (elSmhiStation && weather.station_name) {
        elSmhiStation.textContent = weather.station_name;
    }
}

// Render Map Markers
function renderMapMarkers() {
    AppState.layerGroups.bikes.clearLayers();
    AppState.layerGroups.gyms.clearLayers();
    AppState.layerGroups.tracks.clearLayers();

    AppState.markers.bikes = {};
    AppState.markers.gyms = {};
    AppState.markers.tracks = {};

    // 1. Bike Counters
    AppState.data.counters.forEach(counter => {
        const iconHtml = `<div class="marker-pin-bike" style="width: 28px; height: 28px;">${ICONS.bike}</div>`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-bike-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const marker = L.marker([counter.lat, counter.lon], { icon: customIcon });

        const popupContent = `
            <div class="popup-title">${counter.name}</div>
            <div class="popup-sub">${counter.district} &bull; ${counter.location_desc}</div>
            <div class="popup-stats-grid">
                <div>
                    <div class="popup-stat-label">VARDAGSDYGN</div>
                    <div class="popup-stat-val">${counter.daily_avg.toLocaleString('sv-SE')}</div>
                </div>
                <div>
                    <div class="popup-stat-label">PENDLINGSANDEL</div>
                    <div class="popup-stat-val">${counter.commuter_share_pct} %</div>
                </div>
                <div>
                    <div class="popup-stat-label">MORGONTOPP (08)</div>
                    <div class="popup-stat-val">${counter.rush_hour_am.toLocaleString('sv-SE')} /h</div>
                </div>
                <div>
                    <div class="popup-stat-label">KVÄLLSTOPP (17)</div>
                    <div class="popup-stat-val">${counter.rush_hour_pm.toLocaleString('sv-SE')} /h</div>
                </div>
            </div>
            <div class="popup-desc">
                Regnkänslighet: <strong>-${counter.rain_sensitivity_pct}% per mm regn</strong>.
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 320 });
        AppState.layerGroups.bikes.addLayer(marker);
        AppState.markers.bikes[counter.id] = { marker, data: counter };
    });

    // 2. Outdoor Gyms
    AppState.data.gyms.forEach(gym => {
        const iconHtml = `<div class="marker-pin-gym" style="width: 26px; height: 26px;">${ICONS.gym}</div>`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-gym-marker',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });

        const marker = L.marker([gym.lat, gym.lon], { icon: customIcon });

        const equipmentBadges = gym.equipment.map(eq => `<span class="popup-tag">${eq}</span>`).join('');

        const popupContent = `
            <div class="popup-title">${gym.name}</div>
            <div class="popup-sub">${gym.district} &bull; ${gym.location}</div>
            <div class="popup-stats-grid">
                <div>
                    <div class="popup-stat-label">BETYG</div>
                    <div class="popup-stat-val" style="color: #fbbf24;">${gym.rating} ★</div>
                </div>
                <div>
                    <div class="popup-stat-label">STATIONER</div>
                    <div class="popup-stat-val">${gym.stations_count} st</div>
                </div>
                <div>
                    <div class="popup-stat-label">BELYSNING</div>
                    <div class="popup-stat-val">${gym.lighting ? gym.lighting_desc : 'Ej belyst'}</div>
                </div>
                <div>
                    <div class="popup-stat-label">TILLGÄNGLIGT</div>
                    <div class="popup-stat-val">${gym.accessible ? 'Ja' : 'Nej'}</div>
                </div>
            </div>
            <div class="popup-desc">${gym.desc}</div>
            <div class="popup-tags">${equipmentBadges}</div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 340 });
        AppState.layerGroups.gyms.addLayer(marker);
        AppState.markers.gyms[gym.id] = { marker, data: gym };
    });

    // 3. Running Tracks
    AppState.data.tracks.forEach(track => {
        const iconHtml = `<div class="marker-pin-track" style="width: 26px; height: 26px;">${ICONS.track}</div>`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-track-marker',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });

        const marker = L.marker([track.start_lat, track.start_lon], { icon: customIcon });

        const popupContent = `
            <div class="popup-title">${track.name}</div>
            <div class="popup-sub">${track.district} &bull; Start: ${track.start_desc}</div>
            <div class="popup-stats-grid">
                <div>
                    <div class="popup-stat-label">BANLÄNGD</div>
                    <div class="popup-stat-val">${track.length_km} km</div>
                </div>
                <div>
                    <div class="popup-stat-label">UNDERLAG</div>
                    <div class="popup-stat-val">${track.surface}</div>
                </div>
                <div>
                    <div class="popup-stat-label">BELYSNING</div>
                    <div class="popup-stat-val">${track.lighting}</div>
                </div>
                <div>
                    <div class="popup-stat-label">HÖJDMETER</div>
                    <div class="popup-stat-val">+${track.elevation_m} m</div>
                </div>
            </div>
            <div class="popup-desc">${track.desc}</div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 330 });
        AppState.layerGroups.tracks.addLayer(marker);
        AppState.markers.tracks[track.id] = { marker, data: track };
    });
}

// Apply Filters to Map Markers
function applyFilters() {
    const selectedDist = AppState.selectedDistrict;
    const { lightingOnly, accessibleOnly } = AppState.gymFilters;

    // Filter Bikes
    let visibleBikesCount = 0;
    Object.values(AppState.markers.bikes).forEach(({ marker, data }) => {
        const matchDistrict = (selectedDist === 'all' || data.district.toLowerCase().includes(selectedDist.toLowerCase()));
        if (matchDistrict) {
            if (!AppState.layerGroups.bikes.hasLayer(marker) && AppState.layers.bikes) {
                AppState.layerGroups.bikes.addLayer(marker);
            }
            visibleBikesCount++;
        } else {
            AppState.layerGroups.bikes.removeLayer(marker);
        }
    });

    // Filter Gyms
    let visibleGymsCount = 0;
    Object.values(AppState.markers.gyms).forEach(({ marker, data }) => {
        const matchDistrict = (selectedDist === 'all' || data.district.toLowerCase().includes(selectedDist.toLowerCase()));
        const matchLighting = !lightingOnly || data.lighting === true;
        const matchAccessible = !accessibleOnly || data.accessible === true;

        if (matchDistrict && matchLighting && matchAccessible) {
            if (!AppState.layerGroups.gyms.hasLayer(marker) && AppState.layers.gyms) {
                AppState.layerGroups.gyms.addLayer(marker);
            }
            visibleGymsCount++;
        } else {
            AppState.layerGroups.gyms.removeLayer(marker);
        }
    });

    // Filter Tracks
    Object.values(AppState.markers.tracks).forEach(({ marker, data }) => {
        const matchDistrict = (selectedDist === 'all' || data.district.toLowerCase().includes(selectedDist.toLowerCase()));
        if (matchDistrict) {
            if (!AppState.layerGroups.tracks.hasLayer(marker) && AppState.layers.tracks) {
                AppState.layerGroups.tracks.addLayer(marker);
            }
        } else {
            AppState.layerGroups.tracks.removeLayer(marker);
        }
    });

    // Filter Counters Table
    filterCountersTable(selectedDist);

    // Update Counter Text
    updateActiveCounts(visibleBikesCount, visibleGymsCount);
}

// Update Active Counts Text
function updateActiveCounts(bikesCount, gymsCount) {
    if (bikesCount === undefined) {
        bikesCount = Object.values(AppState.markers.bikes).length;
    }
    if (gymsCount === undefined) {
        gymsCount = Object.values(AppState.markers.gyms).length;
    }

    const countsEl = document.getElementById('activeCountsText');
    if (countsEl) {
        countsEl.innerHTML = `Visar <strong>${bikesCount}</strong> cykelbroar &bull; <strong>${gymsCount}</strong> utegym`;
    }
}

// Render Leaderboard
function renderLeaderboard() {
    const grid = document.getElementById('leaderboardGrid');
    const descEl = document.getElementById('leaderboardMetricDesc');
    if (!grid) return;

    grid.innerHTML = '';
    const tab = AppState.activeLeaderboardTab;

    if (tab === 'bikes') {
        if (descEl) descEl.textContent = 'Topp 10 cykelpassager i Stockholm rankade efter genomsnittligt vardagsflöde.';
        
        // Sort counters by daily_avg desc
        const sorted = [...AppState.data.counters].sort((a, b) => b.daily_avg - a.daily_avg).slice(0, 10);
        
        sorted.forEach((item, index) => {
            const rank = index + 1;
            const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : 'rank-norm'));

            const card = document.createElement('div');
            card.className = 'leaderboard-item';
            card.innerHTML = `
                <div class="item-rank ${rankClass}">${rank}</div>
                <div class="item-content">
                    <div class="item-name">${item.name}</div>
                    <div class="item-sub">${item.district} &bull; Rusning 08: ${item.rush_hour_am.toLocaleString('sv-SE')}/h</div>
                </div>
                <div class="item-metric-wrap">
                    <div class="item-metric-val mono">${item.daily_avg.toLocaleString('sv-SE')}</div>
                    <span class="item-metric-unit">cyklister/dygn</span>
                </div>
            `;

            card.addEventListener('click', () => {
                selectAndHighlightItem('bikes', item.id, item.lat, item.lon, card);
            });

            grid.appendChild(card);
        });

    } else if (tab === 'gyms-rating') {
        if (descEl) descEl.textContent = 'Topp 10 utegym i Stockholm rankade efter användarbetyg och kvalitet.';
        
        const sorted = [...AppState.data.gyms].sort((a, b) => b.rating - a.rating || b.stations_count - a.stations_count).slice(0, 10);
        
        sorted.forEach((item, index) => {
            const rank = index + 1;
            const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : 'rank-norm'));

            const card = document.createElement('div');
            card.className = 'leaderboard-item';
            card.innerHTML = `
                <div class="item-rank ${rankClass}">${rank}</div>
                <div class="item-content">
                    <div class="item-name">${item.name}</div>
                    <div class="item-sub">${item.district} &bull; ${item.stations_count} stationer &bull; ${item.lighting ? 'Belyst' : 'Ej belyst'}</div>
                </div>
                <div class="item-metric-wrap">
                    <div class="item-metric-val mono" style="color: #fbbf24;">${item.rating} ★</div>
                    <span class="item-metric-unit">av 5.0</span>
                </div>
            `;

            card.addEventListener('click', () => {
                selectAndHighlightItem('gyms', item.id, item.lat, item.lon, card);
            });

            grid.appendChild(card);
        });

    } else if (tab === 'gyms-stations') {
        if (descEl) descEl.textContent = 'Topp 10 utegym i Stockholm med flest träningsstationer och redskap.';
        
        const sorted = [...AppState.data.gyms].sort((a, b) => b.stations_count - a.stations_count || b.rating - a.rating).slice(0, 10);
        
        sorted.forEach((item, index) => {
            const rank = index + 1;
            const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : 'rank-norm'));

            const card = document.createElement('div');
            card.className = 'leaderboard-item';
            card.innerHTML = `
                <div class="item-rank ${rankClass}">${rank}</div>
                <div class="item-content">
                    <div class="item-name">${item.name}</div>
                    <div class="item-sub">${item.district} &bull; Material: ${item.material}</div>
                </div>
                <div class="item-metric-wrap">
                    <div class="item-metric-val mono" style="color: #10b981;">${item.stations_count}</div>
                    <span class="item-metric-unit">stationer</span>
                </div>
            `;

            card.addEventListener('click', () => {
                selectAndHighlightItem('gyms', item.id, item.lat, item.lon, card);
            });

            grid.appendChild(card);
        });
    }
}

// Select Item and Smooth Pan & Highlight on Map
function selectAndHighlightItem(layerType, id, lat, lon, cardEl) {
    // 1. Highlight clicked card
    document.querySelectorAll('.leaderboard-item').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');

    // 2. Ensure the layer is active on the map
    if (!AppState.layers[layerType]) {
        AppState.layers[layerType] = true;
        AppState.map.addLayer(AppState.layerGroups[layerType]);
        const layerBtn = document.querySelector(`.layer-btn[data-layer="${layerType}"]`);
        if (layerBtn) layerBtn.classList.add('active');
    }

    // 3. Pan and zoom smoothly to coordinates
    AppState.map.flyTo([lat, lon], 15, {
        animate: true,
        duration: 1.2
    });

    // 4. Open Marker Popup and pulse
    const itemMarker = AppState.markers[layerType][id];
    if (itemMarker && itemMarker.marker) {
        setTimeout(() => {
            itemMarker.marker.openPopup();
            
            // Add pulse effect to marker DOM element
            const el = itemMarker.marker.getElement();
            if (el) {
                el.classList.add('marker-pulse-active');
                setTimeout(() => {
                    el.classList.remove('marker-pulse-active');
                }, 3500);
            }
        }, 600);
    }
}

// Render Narrative Insights Feed
function renderInsightsFeed(analytics) {
    const feed = document.getElementById('insightsFeed');
    if (!feed) return;
    feed.innerHTML = '';

    const stories = analytics.data_stories || [];

    stories.forEach(story => {
        const badgeColor = story.badge === 'Analys' ? 'badge-orange' : (story.badge === 'Väderpåverkan' ? 'badge-cyan' : 'badge-emerald');
        
        const card = document.createElement('div');
        card.className = 'insight-card';
        card.innerHTML = `
            <div class="insight-header">
                <div class="insight-title">${story.title}</div>
                <span class="insight-badge ${badgeColor}">${story.badge}</span>
            </div>
            <div class="insight-body">
                ${story.summary}
            </div>
            <div class="insight-stat-box">
                <span class="stat-label">Nyckeltal</span>
                <span class="stat-value mono">${story.stat}</span>
            </div>
        `;
        feed.appendChild(card);
    });
}

// Render Counters Table
function renderCountersTable(counters) {
    const tbody = document.getElementById('countersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    counters.forEach(c => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', c.id);
        row.setAttribute('data-district', c.district);
        row.style.cursor = 'pointer';

        row.innerHTML = `
            <td><strong>${c.name}</strong><br><span style="font-size: 0.75rem; color: #94a3b8;">${c.location_desc}</span></td>
            <td>${c.district}</td>
            <td class="mono"><strong>${c.daily_avg.toLocaleString('sv-SE')}</strong></td>
            <td class="mono">${c.rush_hour_am.toLocaleString('sv-SE')} /h</td>
            <td class="mono">${c.rush_hour_pm.toLocaleString('sv-SE')} /h</td>
            <td>${c.commuter_share_pct} %</td>
            <td style="color: #f87171;">-${c.rain_sensitivity_pct} %/mm</td>
            <td><span class="badge-status">Aktiv</span></td>
        `;

        row.addEventListener('click', () => {
            selectAndHighlightItem('bikes', c.id, c.lat, c.lon, null);
        });

        tbody.appendChild(row);
    });
}

// Filter Counters Table Rows
function filterCountersTable(district) {
    const rows = document.querySelectorAll('#countersTableBody tr');
    rows.forEach(r => {
        const rowDist = r.getAttribute('data-district');
        if (district === 'all' || rowDist.toLowerCase().includes(district.toLowerCase())) {
            r.style.display = '';
        } else {
            r.style.display = 'none';
        }
    });
}

// Render Chart 1: 72-Hour Timeline (Cykeltrafik vs SMHI Regn & Temp)
function renderTimelineChart(timeline, analytics) {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;

    if (AppState.charts.timeline) {
        AppState.charts.timeline.destroy();
    }

    const labels = timeline.map(pt => {
        const d = new Date(pt.timestamp);
        const days = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
        const day = days[d.getDay()];
        const hour = String(d.getHours()).padStart(2, '0');
        return `${day} ${hour}:00`;
    });

    const bikeFlows = timeline.map(pt => pt.bike_flow);
    const rainMm = timeline.map(pt => pt.rain_mm);
    const temperatures = timeline.map(pt => pt.temp_c);

    AppState.charts.timeline = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Cykeltrafik (passager/timme)',
                    data: bikeFlows,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.15)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'SMHI Nederbörd (mm/h)',
                    data: rainMm,
                    backgroundColor: 'rgba(6, 182, 212, 0.75)',
                    borderColor: '#06b6d4',
                    borderWidth: 1,
                    yAxisID: 'y1'
                },
                {
                    type: 'line',
                    label: 'Temperatur (°C)',
                    data: temperatures,
                    borderColor: '#fbbf24',
                    borderDash: [4, 4],
                    borderWidth: 1.8,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    yAxisID: 'y2'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
                        boxWidth: 14,
                        padding: 18
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#e2e8f0',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#64748b',
                        maxTicksLimit: 12,
                        font: { family: 'JetBrains Mono', size: 11 }
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Cykeltrafik (passager/h)',
                        color: '#f97316',
                        font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
                    },
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'JetBrains Mono', size: 11 }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Nederbörd (mm/h)',
                        color: '#06b6d4',
                        font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
                    },
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#06b6d4',
                        font: { family: 'JetBrains Mono', size: 11 }
                    },
                    min: 0,
                    max: 8
                },
                y2: {
                    type: 'linear',
                    position: 'right',
                    display: false,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// Render Chart 2: 24-Hour Diurnal Rush Hour Curve
function renderRushHourChart(profile) {
    const ctx = document.getElementById('rushHourChart');
    if (!ctx) return;

    if (AppState.charts.rushHour) {
        AppState.charts.rushHour.destroy();
    }

    const labels = profile.map(p => `${String(p.hour).padStart(2, '0')}:00`);
    const flows = profile.map(p => p.avg_flow);

    AppState.charts.rushHour = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Snittflöde cykelpassager',
                data: flows,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointBackgroundColor: '#f97316',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#e2e8f0',
                    borderColor: '#374151',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => ` ${ctx.raw.toLocaleString('sv-SE')} passager/h`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#64748b',
                        maxTicksLimit: 8,
                        font: { family: 'JetBrains Mono', size: 11 }
                    }
                },
                y: {
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'JetBrains Mono', size: 11 }
                    }
                }
            }
        }
    });
}

// Render Chart 3: District Fitness Equity Bar Chart
function renderDistrictBarChart(districts) {
    const ctx = document.getElementById('districtBarChart');
    if (!ctx) return;

    if (AppState.charts.districtBar) {
        AppState.charts.districtBar.destroy();
    }

    const labels = districts.map(d => d.name);
    const gymsPer10k = districts.map(d => d.gyms_per_10k);
    const stationCounts = districts.map(d => d.total_stations);

    AppState.charts.districtBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Utegym per 10 000 invånare',
                    data: gymsPer10k,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Totalt antal träningsstationer',
                    data: stationCounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.65)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: '#374151',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    }
                },
                y: {
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 11 }
                    }
                }
            }
        }
    });
}
