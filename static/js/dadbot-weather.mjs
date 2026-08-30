// Dadbot weather data helpers (Open-Meteo migration, 2026-08).
// Pure functions + versioned cache helpers are exported for tests; the
// page-facing network code lives at the bottom and keeps no globals.

export const LOCATION_CACHE_KEY = 'dadbot_weather_location_v2';
export const FORECAST_CACHE_KEY = 'dadbot_weather_forecast_v2';
export const LEGACY_CACHE_KEYS = ['wttr_location', 'wttr_weather_data', 'wttr_user_location'];
const LOCATION_TTL = 24 * 60 * 60 * 1000;
const FORECAST_TTL = 30 * 60 * 1000;

// --- WMO weather codes ------------------------------------------------------

const WEATHER_CODES = [
  { max: 0, label: 'Clear', icon: '☀️' },
  { max: 1, label: 'Mainly clear', icon: '🌤️' },
  { max: 2, label: 'Partly cloudy', icon: '⛅' },
  { max: 3, label: 'Overcast', icon: '☁️' },
  { min: 45, max: 48, label: 'Fog', icon: '🌫️' },
  { min: 51, max: 57, label: 'Drizzle', icon: '🌦️' },
  { min: 61, max: 67, label: 'Rain', icon: '🌧️' },
  { min: 71, max: 77, label: 'Snow', icon: '🌨️' },
  { min: 80, max: 82, label: 'Rain showers', icon: '🌧️' },
  { min: 85, max: 86, label: 'Snow showers', icon: '🌨️' },
  { min: 95, max: 99, label: 'Thunderstorm', icon: '⛈️' },
];

export function describeWeatherCode(code) {
  const value = Number(code);
  if (!Number.isFinite(code)) return { label: 'Unknown conditions', icon: '🌡️' };
  for (const entry of WEATHER_CODES) {
    const min = entry.min ?? 0;
    if (code >= min && code <= entry.max) {
      return { label: entry.label, icon: entry.icon };
    }
  }
  return { label: 'Unknown conditions', icon: '🌡️' };
}

export function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

// --- Location handling --------------------------------------------------------

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeLocation(result) {
  if (!result || typeof result.name !== 'string' || !result.name.trim()) return null;
  if (!isFiniteNumber(result.latitude) || !isFiniteNumber(result.longitude)) return null;
  return {
    name: result.name.trim(),
    admin1: typeof result.admin1 === 'string' ? result.admin1 : '',
    country: typeof result.country === 'string' ? result.country : '',
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: typeof result.timezone === 'string' && result.timezone ? result.timezone : null,
  };
}

export function formatLocationName(location) {
  if (!location || !location.name) return '';
  const parts = [location.name];
  if (location.admin1 && location.admin1 !== location.name) parts.push(location.admin1);
  if (location.country && location.country !== location.name && location.country !== location.admin1) {
    parts.push(location.country);
  }
  return parts.join(', ');
}

// --- Location search dropdown (roadmap item 17) --------------------------------

const GEOCODING_MIN_CHARS = 2;

export function normalizeGeocodeResults(payload) {
  const results = payload && Array.isArray(payload.results) ? payload.results : [];
  return results
    .map((entry) => normalizeLocation(entry))
    .filter(Boolean);
}

export function shouldQueryGeocoder(value) {
  return typeof value === 'string' && value.trim().length >= GEOCODING_MIN_CHARS;
}

export function locationOptions(results) {
  return (results || []).map((location) => ({
    label: formatLocationName(location),
    location,
  }));
}

// --- Forecast period selection ----------------------------------------------

const PERIOD_TARGETS = [
  { id: 'morning', hour: 6 },
  { id: 'afternoon', hour: 12 },
  { id: 'evening', hour: 21 },
];

export function selectForecastPeriods(hourly) {
  if (
    !hourly ||
    !Array.isArray(hourly.time) ||
    !Array.isArray(hourly.temperature_2m) ||
    !Array.isArray(hourly.weather_code) ||
    !hourly.time.length
  ) {
    return [];
  }
  const day = String(hourly.time[0]).slice(0, 10);
  const rows = [];
  for (let i = 0; i < hourly.time.length; i += 1) {
    const time = String(hourly.time[i]);
    if (!time.startsWith(day)) continue;
    const temp = Number(hourly.temperature_2m[i]);
    const code = Number(hourly.weather_code[i]);
    if (!Number.isFinite(temp) || !Number.isFinite(code)) continue;
    rows.push({ time, temp, code });
  }
  return PERIOD_TARGETS.map((target) => {
    let best = null;
    let bestDistance = Infinity;
    for (const row of rows) {
      const hour = Number(String(row.time).slice(11, 13));
      const distance = Math.abs(hour - target.hour);
      if (Number.isFinite(distance) && (best === null || distance < bestDistance)) {
        best = row;
        bestDistance = distance;
      }
    }
    if (!best) return null;
    return {
      id: target.id,
      time: best.time,
      temp: Math.round(best.temp),
      code: best.code,
    };
  }).filter(Boolean);
}

export function normalizeForecast(payload) {
  const hourly = payload && payload.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) return null;
  if (!Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.weather_code)) return null;
  if (hourly.temperature_2m.length !== hourly.time.length) return null;
  if (hourly.weather_code.length !== hourly.time.length) return null;
  const hasFiniteTemp = hourly.time.some((_, index) => Number.isFinite(Number(hourly.temperature_2m[index])));
  if (!hasFiniteTemp) return null;
  return {
    hourly: {
      time: hourly.time.map(String),
      temperature_2m: hourly.temperature_2m.map(Number),
      weather_code: hourly.weather_code.map(Number),
    },
  };
}

// --- Request URLs (always encoded) ---------------------------------------------

export function buildForecastUrl(location) {
  if (!isFiniteNumber(location.latitude) || !isFiniteNumber(location.longitude)) {
    throw new Error('Invalid coordinates');
  }
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: 'temperature_2m,weather_code',
    timezone: 'auto',
    forecast_days: '2',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function buildGeocodingUrl(query) {
  const params = new URLSearchParams({
    name: String(query),
    count: '5',
    language: 'en',
    format: 'json',
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

// --- Versioned cache (v2) ------------------------------------------------------

function parseCachedEntry(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.timestamp !== 'number' || !Number.isFinite(entry.timestamp)) return null;
    return entry;
  } catch (error) {
    return null;
  }
}

export function readCachedLocation(storage) {
  try {
    const entry = parseCachedEntry(storage, LOCATION_CACHE_KEY);
    if (!entry || !entry.location) return null;
    // A location Sophie's visitor deliberately chose does not expire;
    // an IP-derived one does (24h TTL). The flag may sit on the entry
    // (writeCachedLocation) or inside the location object (older writes).
    if (
      !isUserSelected(entry.location) &&
      entry.userSelected !== true &&
      Date.now() - entry.timestamp >= LOCATION_TTL
    ) {
      return null;
    }
    return entry.location;
  } catch {
    return null;
  }
}

function isUserSelected(location) {
  return Boolean(location && location.userSelected);
}

/** Remove any cached location so the next visit re-runs IP detection. */
export function clearCachedLocation(storage) {
  try {
    storage.removeItem(LOCATION_CACHE_KEY);
  } catch {}
}

export function writeCachedLocation(storage, location, userSelected = false) {
  try {
    storage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ location, userSelected, timestamp: Date.now() }));
  } catch {}
}

export function clearLegacyCache(storage) {
  for (const key of LEGACY_CACHE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {}
  }
}

export function writeCachedForecast(storage, location, forecast) {
  try {
    storage.setItem(
      FORECAST_CACHE_KEY,
      JSON.stringify({ location, forecast, timestamp: Date.now() }),
    );
  } catch {}
}

export function readCachedForecast(storage, location) {
  try {
    const entry = parseCachedEntry(storage, FORECAST_CACHE_KEY);
    if (!entry || !entry.forecast || !entry.location) return null;
    if (Date.now() - entry.timestamp >= FORECAST_TTL) return null;
    const sameCoords =
      entry.location &&
      entry.location.latitude === location.latitude &&
      entry.location.longitude === location.longitude;
    if (!sameCoords) return null;
    return entry.forecast;
  } catch {
    return null;
  }
}

// --- Page controller ---------------------------------------------------------
// Runs only in a browser with the weather widget present. No globals.

const SHEFFIELD_DEFAULT = {
  name: 'Sheffield',
  admin1: 'England',
  country: 'United Kingdom',
  latitude: 53.3811,
  longitude: -1.4701,
  timezone: 'Europe/London',
};

function initWeatherWidget() {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('weather-ticker');
  const searchInput = document.getElementById('weather-search-input');
  if (!root || !searchInput) return;
  const searchButton = document.getElementById('weather-search-button');
  const searchCell = searchInput.closest('.weather-ticker__search') || root;

  searchInput.setAttribute('role', 'combobox');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.setAttribute('aria-autocomplete', 'list');

  // --- Location dropdown state (roadmap item 17) ---
  const LISTBOX_ID = 'weather-search-listbox';
  const GEOCODING_DEBOUNCE_MS = 250;
  let listboxEl = null;
  let listboxOptions = [];
  let activeIndex = -1;
  let debounceTimer = null;

  try {
    clearLegacyCache(localStorage);
  } catch {}

  let currentLocation = null;
  let currentName = '';
  let requestSeq = 0;

  const setLoading = () => {
    searchInput.value = 'Loading...';
  };

  const renderForecast = (forecast, location) => {
    currentLocation = location;
    currentName = formatLocationName(location);
    for (const copy of [1, 2]) {
      for (const period of forecast.periods) {
        const tempEl = document.getElementById(`temp-${period.id}-${copy}`);
        const descEl = document.getElementById(`desc-${period.id}-${copy}`);
        if (!tempEl || !descEl) continue;
        const described = describeWeatherCode(period.code);
        tempEl.textContent = formatTemperature(period.temp);
        descEl.textContent = `${described.icon} ${described.label}`;
      }
    }
    searchInput.value = currentName;
  };

  const markUnavailable = () => {
    for (const copy of [1, 2]) {
      for (const period of ['morning', 'afternoon', 'evening']) {
        const tempEl = document.getElementById(`temp-${period}-${copy}`);
        const descEl = document.getElementById(`desc-${period}-${copy}`);
        if (tempEl) tempEl.textContent = '--°C';
        if (descEl) descEl.textContent = 'Unavailable';
      }
    }
  };

  const restoreInput = () => {
    if (currentName) searchInput.value = currentName;
  };

  async function loadForecast(location, seq) {
    const cached = readCachedForecast(localStorage, location);
    if (cached && cached.periods && cached.periods.length) {
      if (seq === requestSeq) renderForecast(cached, location);
      return true;
    }
    const response = await fetch(buildForecastUrl(location));
    if (!response.ok) throw new Error('forecast failed');
    const normalized = normalizeForecast(await response.json());
    const periods = normalized ? selectForecastPeriods(normalized.hourly) : [];
    if (!periods.length) throw new Error('no usable forecast periods');
    const forecast = { timezone: normalized.hourly.time[0] ? location.timezone : null, periods };
    writeCachedForecast(localStorage, location, forecast);
    if (seq === requestSeq) renderForecast(forecast, location);
    return true;
  }

  async function useLocation(location) {
    const seq = ++requestSeq;
    setLoading();
    try {
      await loadForecast(location, seq);
    } catch (error) {
      if (seq === requestSeq) {
        markUnavailable();
        restoreInput();
      }
    }
  }

  async function detectLocation() {
    const saved = readCachedLocation(localStorage);
    if (saved) {
      await useLocation(saved);
      return;
    }
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('ip lookup failed');
      const data = await response.json();
      const location = normalizeLocation({
        name: data.city,
        admin1: data.region,
        country: data.country_name,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
      });
      if (!location) throw new Error('ip location invalid');
      writeCachedLocation(localStorage, location, false);
      await useLocation(location);
    } catch (error) {
      await useLocation(SHEFFIELD_DEFAULT);
    }
  }

  // Empty search = forget any saved pick and re-run detection (IP → Sheffield
  // fallback), per Sophie: empty Enter returns the default location.
  async function resetToDetectedLocation() {
    setLoading();
    clearCachedLocation(localStorage);
    await detectLocation();
  }

  // --- Location dropdown rendering (roadmap item 17) ---

  const closeDropdown = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (listboxEl) listboxEl.remove();
    listboxEl = null;
    listboxOptions = [];
    activeIndex = -1;
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    window.removeEventListener('scroll', positionDropdown, true);
    window.removeEventListener('resize', positionDropdown);
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
  };

  const onOutsidePointerDown = (event) => {
    if (!listboxEl) return;
    if (listboxEl.contains(event.target) || searchCell.contains(event.target)) return;
    closeDropdown();
  };

  function positionDropdown() {
    if (!listboxEl) return;
    const cellRect = searchCell.getBoundingClientRect();
    listboxEl.style.left = `${Math.round(cellRect.left)}px`;
    listboxEl.style.top = `${Math.round(cellRect.bottom + 2)}px`;
    listboxEl.style.width = `${Math.round(cellRect.width)}px`;
  }

  const setActiveOption = (index) => {
    if (!listboxEl) return;
    activeIndex = Math.min(Math.max(index, 0), listboxOptions.length - 1);
    for (let i = 0; i < listboxEl.children.length; i += 1) {
      const row = listboxEl.children[i];
      const isActive = i === activeIndex;
      row.setAttribute('aria-selected', isActive ? 'true' : 'false');
      row.classList.toggle('weather-search-option--active', isActive);
    }
    const activeRow = listboxEl.children[activeIndex];
    searchInput.setAttribute('aria-activedescendant', activeRow ? activeRow.id : '');
  };

  const chooseActiveOption = () => {
    if (!listboxEl || activeIndex < 0 || !listboxOptions[activeIndex]) return false;
    const chosen = listboxOptions[activeIndex].location;
    closeDropdown();
    chooseLocation(chosen);
    return true;
  };

  function openDropdown(options) {
    closeDropdown();
    if (!options.length) return;
    listboxOptions = options;
    listboxEl = document.createElement('ul');
    listboxEl.id = LISTBOX_ID;
    listboxEl.className = 'weather-search-dropdown';
    listboxEl.setAttribute('role', 'listbox');
    options.forEach((option, index) => {
      const row = document.createElement('li');
      row.id = `${LISTBOX_ID}-option-${index}`;
      row.className = 'weather-search-option';
      row.setAttribute('role', 'option');
      row.textContent = option.label;
      row.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setActiveOption(index);
        chooseActiveOption();
      });
      listboxEl.appendChild(row);
    });
    document.body.appendChild(listboxEl);
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    window.addEventListener('scroll', positionDropdown, true);
    window.addEventListener('resize', positionDropdown);
    positionDropdown();
    setActiveOption(0);
    searchInput.setAttribute('aria-expanded', 'true');
    searchInput.setAttribute('aria-controls', LISTBOX_ID);
  }

  async function fetchLocationOptions(query) {
    const response = await fetch(buildGeocodingUrl(query));
    if (!response.ok) throw new Error('geocoding failed');
    return locationOptions(normalizeGeocodeResults(await response.json()));
  }

  const scheduleGeocodeLookup = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const query = searchInput.value;
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      if (!shouldQueryGeocoder(query)) {
        closeDropdown();
        return;
      }
      const seq = ++requestSeq;
      try {
        const options = await fetchLocationOptions(query);
        if (seq !== requestSeq) return;
        openDropdown(options);
      } catch {
        if (seq === requestSeq) closeDropdown();
      }
    }, GEOCODING_DEBOUNCE_MS);
  };

  // Shared success path: load the chosen location's forecast, then persist it
  // as user-selected (never expires). Used by both the dropdown and the
  // legacy first-match search.
  async function chooseLocation(location, seq) {
    if (!Number.isFinite(seq)) seq = ++requestSeq;
    setLoading();
    try {
      await loadForecast(location, seq);
      writeCachedLocation(localStorage, location, true);
    } catch (error) {
      if (seq === requestSeq) {
        searchInput.value = 'Location not found';
        setTimeout(restoreInput, 2000);
      }
    }
  }

  // Focus clears the field so the visitor types fresh (Sophie, item 17
  // follow-up); blur puts the current location name back so the field reads
  // as a display whenever it is not being edited. Blur stands down when
  // focus moves inside the search cell (e.g. the Search button), because the
  // click handler needs the field's real content.
  searchInput.addEventListener('focus', () => {
    if (listboxEl) return;
    searchInput.value = '';
  });

  searchInput.addEventListener('blur', (event) => {
    if (listboxEl) return;
    if (event.relatedTarget && searchCell.contains(event.relatedTarget)) return;
    restoreInput();
  });

  async function submitSearch() {
    const query = searchInput.value.trim();
    if (query === 'Loading...') {
      restoreInput();
      return;
    }
    if (!query) {
      closeDropdown();
      await resetToDetectedLocation();
      return;
    }
    const seq = ++requestSeq;
    setLoading();
    try {
      const response = await fetch(buildGeocodingUrl(query));
      if (!response.ok) throw new Error('geocoding failed');
      const data = await response.json();
      const location = normalizeLocation((data.results && data.results[0]) || null);
      if (!location) throw new Error('location not found');
      await chooseLocation(location, seq);
    } catch (error) {
      if (seq === requestSeq) {
        searchInput.value = 'Location not found';
        setTimeout(restoreInput, 2000);
      }
    }
  }

  searchInput.addEventListener('input', () => {
    scheduleGeocodeLookup();
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && listboxEl) {
      event.preventDefault();
      setActiveOption(activeIndex + 1);
    } else if (event.key === 'ArrowUp' && listboxEl) {
      event.preventDefault();
      setActiveOption(activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!chooseActiveOption()) {
        closeDropdown();
        submitSearch();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      restoreInput();
    }
  });
  if (searchButton) {
    searchButton.addEventListener('click', () => {
      if (!chooseActiveOption()) {
        closeDropdown();
        submitSearch();
      }
    });
  }

  detectLocation();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeatherWidget);
  } else {
    initWeatherWidget();
  }
}
