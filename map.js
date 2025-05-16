// === Add HTML ===
// Already done in the previous step

import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiZWxpbmFsZWJ1ZmYiLCJhIjoiY21hcjF6ZGRlMDZjdDJqb25laTFrZmU4ZSJ9.Dtpp3WMt9a1Lm7JUbdZ_Og';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

function getCoords(station) {
  const lat = parseFloat(station.lat);
  const lon = parseFloat(station.lon);

  if (isNaN(lat) || isNaN(lon)) {
    console.warn('Bad coords:', station);
    return { cx: -1000, cy: -1000 };
  }

  const point = new mapboxgl.LngLat(lon, lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

let timeFilter = -1;
let radiusScale = d3.scaleSqrt().range([0, 25]);
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
const svg = d3.select('#map').select('svg');
let stations = [];
let trips = [];
let circles;

// Slider elements
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function updateTimeDisplay() {
  timeFilter = Number(timeSlider.value);
  if (timeFilter === -1) {
    selectedTime.textContent = '';
    anyTimeLabel.style.display = 'block';
  } else {
    selectedTime.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }
  updateScatterPlot(timeFilter);
}

timeSlider.addEventListener('input', updateTimeDisplay);

function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

  return stations.map(station => {
    const id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

function updateScatterPlot(timeFilter) {
  const filteredTrips = filterTripsbyTime(trips, timeFilter);
  const filteredStations = computeStationTraffic(stations, filteredTrips);

  timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

  svg.selectAll('circle')
    .data(filteredStations, d => d.short_name)
    .join('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('fill', 'var(--color)')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic || 0));

  updatePositions();
}

function updatePositions() {
  svg.selectAll('circle')
    .attr('cx', d => getCoords(d).cx)
    .attr('cy', d => getCoords(d).cy);
}

map.on('load', async () => {
  map.addSource('boston_bikelanes', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });
  map.addLayer({
    id: 'boston_bikelanes',
    type: 'line',
    source: 'boston_bikelanes',
    paint: {
      'line-color': '#32D400',
      'line-width': 4,
      'line-opacity': 0.6
    }
  });

  map.addSource('cambridge_bikelanes', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });
  map.addLayer({
    id: 'cambridge_bikelanes',
    type: 'line',
    source: 'cambridge_bikelanes',
    paint: {
      'line-color': '#32D400',
      'line-width': 4,
      'line-opacity': 0.6
    }
  });

  try {
    const jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    stations = jsonData.data.stations;
  } catch (error) {
    console.error('Error loading JSON:', error);
  }

  trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', (trip) => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at = new Date(trip.ended_at);
    return trip;
  });

  stations = computeStationTraffic(stations, trips);
  radiusScale.domain([0, d3.max(stations, d => d.totalTraffic)]);

  circles = svg
    .selectAll('circle')
    .data(stations, d => d.short_name)
    .enter()
    .append('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('fill', 'var(--color)')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic || 0));

  updatePositions();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  updateTimeDisplay();
});