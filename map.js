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

map.on('load', async () => {
  console.log('Map loaded');

  // Boston bike lanes
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

  // Cambridge bike lanes
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

  // Add Bluebike stations
  const svg = d3.select('#map').select('svg');
  let stations = [];

  try {
    const jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    stations = jsonData.data.stations;
    console.log('Loaded stations:', stations);
  } catch (error) {
    console.error('Error loading JSON:', error);
  }
  console.log('One example station:', stations[0]);

  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8);

  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});