import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractMediaCoordinates } from '../v2/GeoMapScreen.js';

describe('BUG-019: Interactive Leaflet GeoMapScreen & Coordinates Extraction', () => {
  it('1. extractMediaCoordinates: should extract coordinates from direct properties', () => {
    const file = {
      filename: 'almaty.jpg',
      latitude: 43.2389,
      longitude: 76.8897,
      location_name: 'Алматы',
    };
    const coords = extractMediaCoordinates(file);
    assert.ok(coords, 'Coordinates must be extracted');
    assert.strictEqual(coords.lat, 43.2389);
    assert.strictEqual(coords.lon, 76.8897);
    assert.strictEqual(coords.locationName, 'Алматы');
  });

  it('2. extractMediaCoordinates: should extract coordinates from nested gps object', () => {
    const file = {
      filename: 'rome.jpg',
      gps: {
        latitude: 41.8902,
        longitude: 12.4922,
      },
      city: 'Рим',
    };
    const coords = extractMediaCoordinates(file);
    assert.ok(coords, 'Coordinates must be extracted from gps object');
    assert.strictEqual(coords.lat, 41.8902);
    assert.strictEqual(coords.lon, 12.4922);
    assert.strictEqual(coords.locationName, 'Рим');
  });

  it('3. extractMediaCoordinates: should extract coordinates from exif or sidecar properties', () => {
    const fileWithExif = {
      filename: 'paris.jpg',
      exif: {
        latitude: 48.8566,
        longitude: 2.3522,
      },
    };
    const coordsExif = extractMediaCoordinates(fileWithExif);
    assert.ok(coordsExif);
    assert.strictEqual(coordsExif.lat, 48.8566);
    assert.strictEqual(coordsExif.lon, 2.3522);

    const fileWithSidecar = {
      filename: 'tokyo.jpg',
      sidecar: {
        latitude: 35.6762,
        longitude: 139.6503,
        location_name: 'Токио',
      },
    };
    const coordsSidecar = extractMediaCoordinates(fileWithSidecar);
    assert.ok(coordsSidecar);
    assert.strictEqual(coordsSidecar.lat, 35.6762);
    assert.strictEqual(coordsSidecar.lon, 139.6503);
    assert.strictEqual(coordsSidecar.locationName, 'Токио');
  });

  it('4. extractMediaCoordinates: should reject invalid or null-island coordinates', () => {
    assert.strictEqual(extractMediaCoordinates(null), null);
    assert.strictEqual(extractMediaCoordinates({}), null);
    // Null island (0, 0)
    assert.strictEqual(extractMediaCoordinates({ latitude: 0, longitude: 0 }), null);
    // Out of bounds
    assert.strictEqual(extractMediaCoordinates({ latitude: 95.5, longitude: 10 }), null);
    assert.strictEqual(extractMediaCoordinates({ latitude: 45, longitude: 200 }), null);
  });

  it('5. GeoMapScreen: must initialize Leaflet map with tiles and zoom/pan controls', () => {
    const geoMapPath = path.join(process.cwd(), 'src', 'components', 'v2', 'GeoMapScreen.tsx');
    const content = fs.readFileSync(geoMapPath, 'utf-8');

    const indexCss = fs.readFileSync(path.join(process.cwd(), 'src', 'index.css'), 'utf-8');
    assert.ok(indexCss.includes('leaflet.css'), 'Must import leaflet.css in index.css');
    assert.ok(content.includes('L.map('), 'Must initialize Leaflet map instance');
    assert.ok(content.includes('L.tileLayer('), 'Must configure tile layer');
    assert.ok(content.includes('L.divIcon('), 'Must use L.divIcon for custom interactive markers');
    assert.ok(content.includes('zoomIn') && content.includes('zoomOut'), 'Must have zoomIn and zoomOut controls');
    assert.ok(content.includes('fitAllMarkers') || content.includes('fitBounds'), 'Must support fitting bounds to photos');
    assert.ok(content.includes('/api/media/thumbnail?path='), 'Must load thumbnails via standard /api/media/thumbnail?path=');
  });
});
