import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL('../../static/js/dadbot-weather.mjs', import.meta.url);
const weather = await import(moduleUrl.href);

// --- WMO weather-code mapping -------------------------------------------

test('WMO code 0 maps to clear weather and the sunny icon', () => {
  const d = weather.describeWeatherCode(0);
  assert.equal(d.label, 'Clear');
  assert.equal(d.icon, '☀️');
});

test('codes 1, 2 and 3 map to mainly clear, partly cloudy and overcast', () => {
  assert.equal(weather.describeWeatherCode(1).label, 'Mainly clear');
  assert.equal(weather.describeWeatherCode(2).label, 'Partly cloudy');
  assert.equal(weather.describeWeatherCode(3).label, 'Overcast');
});

test('rain, snow, fog and thunderstorm code groups map to truthful labels', () => {
  assert.equal(weather.describeWeatherCode(61).label, 'Rain');
  assert.equal(weather.describeWeatherCode(65).label, 'Rain');
  assert.equal(weather.describeWeatherCode(71).label, 'Snow');
  assert.equal(weather.describeWeatherCode(75).label, 'Snow');
  assert.equal(weather.describeWeatherCode(45).label, 'Fog');
  assert.equal(weather.describeWeatherCode(48).label, 'Fog');
  assert.equal(weather.describeWeatherCode(95).label, 'Thunderstorm');
  assert.equal(weather.describeWeatherCode(99).label, 'Thunderstorm');
});

test('unknown codes return a neutral thermometer icon and Unknown conditions', () => {
  const d = weather.describeWeatherCode(12345);
  assert.equal(d.label, 'Unknown conditions');
  assert.equal(d.icon, '🌡️');
});

// --- Forecast period selection ------------------------------------------

const hourlyFixture = {
  time: [
    '2026-08-29T00:00', '2026-08-29T03:00', '2026-08-29T06:00', '2026-08-29T09:00',
    '2026-08-29T12:00', '2026-08-29T15:00', '2026-08-29T18:00', '2026-08-29T21:00',
    '2026-08-30T00:00', '2026-08-30T06:00', '2026-08-30T12:00', '2026-08-30T21:00',
  ],
  temperature_2m: [9.4, 8.8, 11.25, 14.1, 17.6, 18.2, 16.4, 13.05, 10.1, 12.3, 16.9, 12.7],
  weather_code: [3, 3, 1, 2, 0, 0, 2, 3, 3, 61, 80, 3],
};

test('hourly data selects 06:00, 12:00 and 21:00 with rounded temps', () => {
  const periods = weather.selectForecastPeriods(hourlyFixture);
  assert.deepEqual(periods.map((p) => p.id), ['morning', 'afternoon', 'evening']);
  assert.deepEqual(periods.map((p) => p.time), ['2026-08-29T06:00', '2026-08-29T12:00', '2026-08-29T21:00']);
  assert.deepEqual(periods.map((p) => p.temp), [11, 18, 13]);
  assert.deepEqual(periods.map((p) => p.code), [1, 0, 3]);
});

test('missing exact hours choose the nearest valid hour, not the first row', () => {
  const sparse = {
    time: ['2026-08-29T05:00', '2026-08-29T13:00', '2026-08-29T20:00'],
    temperature_2m: [10.4, 17.9, 12.3],
    weather_code: [1, 0, 2],
  };
  const periods = weather.selectForecastPeriods(sparse);
  assert.deepEqual(periods.map((p) => p.time), ['2026-08-29T05:00', '2026-08-29T13:00', '2026-08-29T20:00']);
  assert.deepEqual(periods.map((p) => p.temp), [10, 18, 12]);
});

// --- Payload validation ---------------------------------------------------

test('invalid or incomplete forecast payloads fail safely', () => {
  assert.equal(weather.normalizeForecast(null), null);
  assert.equal(weather.normalizeForecast({}), null);
  assert.equal(
    weather.normalizeForecast({ hourly: { time: [], temperature_2m: [], weather_code: [] } }),
    null,
  );
  assert.equal(
    weather.normalizeForecast({ hourly: { time: ['2026-08-29T06:00'], temperature_2m: [NaN], weather_code: [0] } }),
    null,
  );
});

test('temperatures stay bare numbers; °C is appended only by the UI formatter', () => {
  const formatted = weather.formatTemperature(11.25);
  assert.ok(formatted.includes('11'));
  assert.ok(formatted.includes('°C'));
  const periods = weather.selectForecastPeriods(hourlyFixture);
  assert.ok(periods.every((p) => typeof p.temp === 'number'));
});

// --- Geocoding location handling -----------------------------------------

test('normalizeLocation keeps the fields the widget needs and rejects junk', () => {
  const loc = weather.normalizeLocation({
    name: 'London', admin1: 'England', country: 'United Kingdom',
    latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London',
  });
  assert.equal(loc.name, 'London');
  assert.equal(loc.latitude, 51.5072);
  assert.equal(loc.timezone, 'Europe/London');

  assert.equal(weather.normalizeLocation({ name: 'Nowhere' }), null);
  assert.equal(weather.normalizeLocation({ name: 'X', latitude: 'far', longitude: 'away' }), null);
});

test('formatLocationName shows region and country without duplicates', () => {
  assert.equal(
    weather.formatLocationName({ name: 'London', admin1: 'England', country: 'United Kingdom' }),
    'London, England, United Kingdom',
  );
  assert.equal(weather.formatLocationName({ name: 'Sheffield', admin1: 'Sheffield', country: 'United Kingdom' }), 'Sheffield, United Kingdom');
  assert.equal(weather.formatLocationName({ name: 'Monaco', country: 'Monaco' }), 'Monaco');
});

// --- URL builders ---------------------------------------------------------

test('forecast and geocoding URLs encode parameters safely', () => {
  const f = new URL(weather.buildForecastUrl({ latitude: 52.04172, longitude: -0.75583 }));
  assert.equal(f.origin + f.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(f.searchParams.get('latitude'), '52.04172');
  assert.equal(f.searchParams.get('longitude'), '-0.75583');
  assert.equal(f.searchParams.get('hourly'), 'temperature_2m,weather_code');
  assert.equal(f.searchParams.get('timezone'), 'auto');
  assert.equal(f.searchParams.get('forecast_days'), '2');

  const g = new URL(weather.buildGeocodingUrl('Milton Keynes'));
  assert.equal(g.origin + g.pathname, 'https://geocoding-api.open-meteo.com/v1/search');
  assert.equal(g.searchParams.get('name'), 'Milton Keynes');
  assert.equal(g.searchParams.get('count'), '5');
  assert.equal(g.searchParams.get('language'), 'en');
  assert.equal(g.searchParams.get('format'), 'json');
});

// --- Cache v2 rules -------------------------------------------------------

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const LOCATION_V2 = 'dadbot_weather_location_v2';
const FORECAST_V2 = 'dadbot_weather_forecast_v2';
const location = {
  name: 'Milton Keynes', admin1: 'England', country: 'United Kingdom',
  latitude: 52.04172, longitude: -0.75583, timezone: 'Europe/London',
};

test('fresh v2 cache is accepted and expired cache is rejected', () => {
  const storage = makeStorage();
  weather.writeCachedLocation(storage, location);
  assert.deepEqual(weather.readCachedLocation(storage), location);

  const stale = { location, timestamp: Date.now() - 25 * 60 * 60 * 1000 };
  storage.setItem(LOCATION_V2, JSON.stringify(stale));
  assert.equal(weather.readCachedLocation(storage), null);
});

test('corrupt or incomplete cache fails safely instead of throwing', () => {
  const storage = makeStorage();
  storage.setItem(LOCATION_V2, '{not json');
  assert.equal(weather.readCachedLocation(storage), null);
  storage.setItem(LOCATION_V2, JSON.stringify({ nonsense: true }));
  assert.equal(weather.readCachedLocation(storage), null);
});

test('forecast cache binds to the requested coordinates', () => {
  const storage = makeStorage();
  const forecast = { timezone: 'Europe/London', periods: [{ id: 'morning', temp: 11, code: 1 }] };
  weather.writeCachedForecast(storage, location, forecast);
  assert.deepEqual(weather.readCachedForecast(storage, location), forecast);

  const elsewhere = { ...location, latitude: 51.5 };
  assert.equal(weather.readCachedForecast(storage, elsewhere), null);

  const stale = { location, forecast, timestamp: Date.now() - 31 * 60 * 1000 };
  storage.setItem(FORECAST_V2, JSON.stringify(stale));
  assert.equal(weather.readCachedForecast(storage, location), null);
});

test('legacy wttr_* keys are removed and never read', () => {
  const storage = makeStorage();
  for (const key of ['wttr_location', 'wttr_weather_data', 'wttr_user_location']) {
    storage.setItem(key, '{"evil":"wttr"}');
  }
  weather.clearLegacyCache(storage);
  for (const key of ['wttr_location', 'wttr_weather_data', 'wttr_user_location']) {
    assert.equal(storage.getItem(key), null, `${key} should be removed`);
  }
  assert.equal(weather.readCachedLocation(storage), null);
});
