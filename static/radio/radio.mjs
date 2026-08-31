// Dadbot Radio — pure helpers + simulated spectrum engine + page controller.
// (Roadmap item 19, v2 mock-faithful rebuild.) Pure functions are exported for
// tests; the controller runs only when the radio desk DOM is present.

export const COUNTRIES_CACHE_KEY = 'dadbot_radio_countries_v1';
export const LANGUAGES_CACHE_KEY = 'dadbot_radio_languages_v1';
export const COUNTRIES_TTL = 24 * 60 * 60 * 1000;
export const DEFAULT_REGION = 'Europe';
export const DEFAULT_COUNTRY = 'United Kingdom';

const API_BASE = 'https://de1.api.radio-browser.info/json';

// --- station normalisation -----------------------------------------------------

export function normalizeStation(raw, source = 'directory') {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  const url = typeof raw.url_resolved === 'string' ? raw.url_resolved : raw.streamUrl;
  if (typeof url !== 'string' || !url.trim()) return null;
  const lat = Number(raw.geo_lat);
  const lon = Number(raw.geo_long);
  const geo =
    Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)
      ? { lat, lon }
      : null;
  const tags =
    typeof raw.tags === 'string' && raw.tags.trim()
      ? raw.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3)
      : [];
  const languagecodes =
    typeof raw.languagecodes === 'string' && raw.languagecodes.trim()
      ? raw.languagecodes.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : typeof raw.languagecodes === 'object' && Array.isArray(raw.languagecodes)
        ? raw.languagecodes.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
        : [];
  const codec = typeof raw.codec === 'string' && raw.codec.trim() ? raw.codec.trim().toUpperCase() : '';
  const bitrate = Number.isFinite(Number(raw.bitrate)) && Number(raw.bitrate) > 0 ? Number(raw.bitrate) : null;
  return {
    id: raw.stationuuid || raw.id || null,
    name: raw.name.trim(),
    streamUrl: url,
    homepage: typeof raw.homepage === 'string' ? raw.homepage : '',
    country: typeof raw.country === 'string' ? raw.country : '',
    countryCode: typeof raw.countrycode === 'string' ? raw.countrycode : '',
    region: typeof raw.state === 'string' ? raw.state : typeof raw.region === 'string' ? raw.region : '',
    geo,
    tags,
    languagecodes,
    codec,
    bitrate,
    playable: url.startsWith('https://'),
    source,
  };
}

export function filterPlayable(stations) {
  return (stations || []).filter((s) => s && s.playable === true);
}

// --- presentation -----------------------------------------------------------------

export function formatMetaLine(station) {
  if (!station) return '';
  const parts = [];
  if (station.country) parts.push(station.country);
  for (const tag of station.tags || []) parts.push(tag.charAt(0).toUpperCase() + tag.slice(1));
  if (station.codec && station.bitrate) parts.push(`${station.codec} ${station.bitrate}k`);
  else if (station.bitrate) parts.push(`${station.bitrate}k`);
  return parts.join(' · ');
}

export function filterStations(stations, query) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!q) return [...(stations || [])];
  return (stations || []).filter((s) => s && s.name && s.name.toLowerCase().includes(q));
}

/** Lucky dial: pick a random station from the pool, skipping excluded ids
 *  (recently played). Returns null when nothing eligible remains. Pure. */
export function pickRandomStation(pool, excludeIds) {
  const eligible = (pool || []).filter((s) => s && s.id && !(excludeIds && excludeIds.has(s.id)));
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// --- simulated graphic-EQ engine ------------------------------------------------------
// Height per bar: summed sine waves driven by an ELAPSED-TIME clock (per-bar
// phase) + randomness, normalised. The clock is what makes targets keep
// moving: bars chase ever-changing heights, easing UP FAST, DOWN SLOW.
// energy 0 = decay to floor. Pure functions.

export function advanceSpectrum(bars, dt, energy, time = 0) {
  const out = new Array(bars.length);
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const t = Number.isFinite(time) ? time : 0;
  for (let i = 0; i < bars.length; i += 1) {
    const current = Number.isFinite(bars[i]) ? bars[i] : 0;
    if (step === 0) {
      out[i] = current;
      continue;
    }
    // Wandering target: three summed sines at distinct frequencies, each with
    // per-bar phase, evolving on the elapsed clock; plus a jitter term.
    const phase = i * 1.7;
    const wave =
      0.42 * Math.sin(phase + t * 2.3) +
      0.31 * Math.sin(i * 0.83 + t * 3.9) +
      0.27 * Math.sin(i * 0.29 - t * 1.7);
    const noise = 0.5 + 0.5 * Math.sin(i * 12.9898 + t * 7.7); // deterministic jitter
    const wander = 0.5 + 0.5 * wave;
    const target = energy > 0
      ? Math.max(0.05, Math.min(1, wander * (0.6 + 0.4 * energy) + 0.12 * noise))
      : 0.03;
    // Up fast, down slow.
    const rate = target > current ? 6.0 : 1.8;
    const next = current + (target - current) * Math.min(1, rate * step);
    out[i] = Math.max(0.03, Math.min(1, next));
  }
  return out;
}

/** Slow-falling peak caps. A cap floats one segment above its bar's recent
 *  max; it jumps instantly when the bar surges past it, otherwise falls at a
 *  gentle constant rate. Pure: (peaks, bars, dt) -> nextPeaks. */
export function advancePeaks(peaks, bars, dt) {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const out = new Array(peaks.length);
  for (let i = 0; i < peaks.length; i += 1) {
    const bar = Number.isFinite(bars[i]) ? bars[i] : 0;
    const cap = Number.isFinite(peaks[i]) ? peaks[i] : bar;
    if (bar >= cap) {
      out[i] = bar; // instant jump to a surging bar
    } else {
      out[i] = Math.max(bar, cap - step * 0.35); // ~0.35 heights/sec fall
    }
  }
  return out;
}

// --- countries fetch (24h cache) ------------------------------------------------------

export async function fetchCountries() {
  const response = await fetch(`${API_BASE}/countries`);
  if (!response.ok) throw new Error(`radio-browser ${response.status}`);
  return response.json();
}

export async function fetchLanguages() {
  const response = await fetch(`${API_BASE}/languages`);
  if (!response.ok) throw new Error(`radio-browser ${response.status}`);
  return response.json();
}

export function readCachedCountries(storage) {
  try {
    const cached = JSON.parse(storage.getItem(COUNTRIES_CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.rows) && Date.now() - cached.at < COUNTRIES_TTL) {
      return cached.rows;
    }
  } catch {}
  return null;
}

export function writeCachedCountries(storage, rows) {
  try {
    storage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
  } catch {}
}

export function readCachedLanguages(storage) {
  try {
    const cached = JSON.parse(storage.getItem(LANGUAGES_CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.rows) && Date.now() - cached.at < COUNTRIES_TTL) {
      return cached.rows;
    }
  } catch {}
  return null;
}

export function writeCachedLanguages(storage, rows) {
  try {
    storage.setItem(LANGUAGES_CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
  } catch {}
}

// --- Page controller -------------------------------------------------------------------
// Runs only when the radio desk DOM is present. No globals beyond the module.

function initRadioDesk() {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-radio]');
  if (!root) return;

  const clockEl = root.querySelector('[data-radio-clock]');
  const ccEl = root.querySelector('[data-radio-cc]');
  const nameEl = root.querySelector('[data-radio-name]');
  const metaEl = root.querySelector('[data-radio-meta]');
  const statusEl = root.querySelector('[data-radio-status]');
  const canvas = root.querySelector('[data-radio-spectrum]');
  const playBtn = root.querySelector('[data-radio-play]');
  const volumeInput = root.querySelector('[data-radio-volume]');
  const regionTrigger = root.querySelector('[data-radio-region-trigger]');
  const regionListbox = root.querySelector('[data-radio-region-listbox]');
  const regionValue = root.querySelector('[data-radio-region-value]');
  const countryTrigger = root.querySelector('[data-radio-country-trigger]');
  const countryListbox = root.querySelector('[data-radio-country-listbox]');
  const countryValue = root.querySelector('[data-radio-country-value]');
  const languageTrigger = root.querySelector('[data-radio-language-trigger]');
  const languageListbox = root.querySelector('[data-radio-language-listbox]');
  const languageValue = root.querySelector('[data-radio-language-value]');
  const randomBtn = root.querySelector('[data-radio-random]');
  const filterInput = root.querySelector('[data-radio-filter]');
  const hifiBtn = root.querySelector('[data-radio-hifi]');
  const countEl = root.querySelector('[data-radio-count]');
  const listEl = root.querySelector('[data-radio-list]');

  const regions = (typeof window !== 'undefined' && window.DADBOT_REGIONS) || globalThis.DADBOT_REGIONS;

  let stations = [];          // full list for the current country
  let countriesRows = [];     // cached directory countries payload
  let countryOptions = [];    // options currently in the country dropdown
  let visible = [];           // after filter + hifi
  let selected = -1;          // keyboard selection index into visible rows
  let activeId = null;        // currently tuned station id
  let currentStation = null;  // full object (lucky-dial picks aren't in `stations`)
  let isPaused = false;
  let fetchSeq = 0;
  let hifiOn = true;

  // --- spectrum --------------------------------------------------------------------

  const BAR_PITCH = 16;   // 1 bar per 16px (14px bar + 2px gap)
  const SEGMENT_H = 9;    // LED segment height in px (halved 2026-08-30, Sophie)
  const SEG_GAP = 2;      // gap between segments
  const SEG_ROWS = 14;    // LED rows per bar
  let bars = new Array(45).fill(0.06);
  let peaks = new Array(45).fill(0.06);
  let lastFrame = null;
  let spectrumClock = 0; // elapsed seconds the EQ waves evolve on
  let spectrumTimer = null;
  const ctx2d = canvas ? canvas.getContext('2d') : null;

  // Zone colours by height: green (bottom) > amber (mid) > mint (top).
  function segmentColour(row) {
    const pos = row / SEG_ROWS; // 0 = bottom, 1 = top
    if (pos < 0.55) return 'rgba(96, 214, 138, 0.95)';   // green
    if (pos < 0.8) return 'rgba(255, 179, 107, 0.95)';   // amber
    return 'rgba(122, 240, 194, 0.95)';                   // mint
  }

  function sizeCanvas() {
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    // Bar count follows the width: one bar per 16px pitch.
    const count = Math.max(8, Math.floor(rect.width / BAR_PITCH));
    if (count !== bars.length) {
      bars = new Array(count).fill(0.06);
      peaks = new Array(count).fill(0.06);
    }
  }

  function drawSpectrum() {
    if (!ctx2d || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const scale = w / (canvas.getBoundingClientRect().width || w);
    ctx2d.clearRect(0, 0, w, h);

    const count = bars.length;
    const pitch = w / count;
    const barW = Math.max(2, pitch - 2 * scale);
    const rows = SEG_ROWS;
    // Segment height in device px: 18 CSS px * DPR, but never shorter than
    // (available height / rows) so the ladder always fills the box.
    const segH = Math.min(
      Math.round(SEGMENT_H * scale),
      Math.max(2, Math.floor((h - 2 * scale) / rows) - Math.round(SEG_GAP * scale)),
    );
    const segGap = Math.round(SEG_GAP * scale);
    const ghost = 'rgba(120, 226, 160, 0.10)';

    for (let c = 0; c < count; c += 1) {
      const x = c * pitch + Math.max(1, Math.floor((pitch - barW) / 2));
      const lit = Math.max(1, Math.round(bars[c] * rows));
      const capRow = Math.min(rows, Math.max(lit + 1, Math.round(peaks[c] * rows)));
      for (let r = 0; r < rows; r += 1) {
        const y = h - (r + 1) * (segH + segGap) - scale;
        if (r < lit) {
          ctx2d.fillStyle = segmentColour(r); // zone colour by row height
          ctx2d.fillRect(x, y, barW, segH);
        } else if (r === capRow - 1 && peaks[c] > bars[c] + 0.02) {
          // Peak cap: single lit segment floating above the bar.
          ctx2d.fillStyle = 'rgba(122, 240, 194, 0.85)';
          ctx2d.fillRect(x, y, barW, segH);
        } else {
          ctx2d.fillStyle = ghost;
          ctx2d.fillRect(x, y, barW, segH);
        }
      }
    }
  }

  function tickSpectrum() {
    const now = performance.now();
    if (lastFrame === null) lastFrame = now;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    spectrumClock += dt;
    const playing = activeId && !isPaused;
    if (playing) {
      bars = advanceSpectrum(bars, dt, 1, spectrumClock);
      peaks = advancePeaks(peaks, bars, dt);
      drawSpectrum();
    } else if (bars.some((b) => b > 0.04) || peaks.some((p) => p > 0.05)) {
      // Ease everything to the floor, then stop the timer (no idle burn).
      bars = advanceSpectrum(bars, dt, 0, spectrumClock);
      peaks = advancePeaks(peaks, bars, dt);
      drawSpectrum();
    } else {
      bars = bars.map(() => 0.04);
      drawSpectrum();
      clearInterval(spectrumTimer);
      spectrumTimer = null;
      lastFrame = null;
    }
  }

  function startSpectrum() {
    if (!canvas) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      bars = new Array(bars.length).fill(0.45);
      peaks = new Array(peaks.length).fill(0.45);
      sizeCanvas();
      drawSpectrum();
      return;
    }
    sizeCanvas();
    drawSpectrum();
    // ~20fps interval: authentic LED pacing, throttle-proof. The tick
    // self-stops when idle (no CPU burn while paused); every state change
    // below calls ensureSpectrum() to wake it again.
    if (!spectrumTimer) spectrumTimer = setInterval(tickSpectrum, 50);
  }

  function ensureSpectrum() {
    if (!canvas) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lastFrame = null;
    if (!spectrumTimer) spectrumTimer = setInterval(tickSpectrum, 50);
  }

  window.addEventListener('resize', () => {
    if (canvas) { sizeCanvas(); drawSpectrum(); }
  });

  // --- clock ------------------------------------------------------------------------

  function tickClock() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  tickClock();
  setInterval(tickClock, 15000);

  // --- status -------------------------------------------------------------------------

  function setStatus(text, accent = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('is-accent', accent);
  }

  function renderNowPlaying() {
    const station = currentStation && currentStation.id === activeId
      ? currentStation
      : stations.find((s) => s.id === activeId) || null;
    if (nameEl) nameEl.textContent = station ? station.name : '— no signal —';
    if (metaEl) metaEl.textContent = station ? formatMetaLine(station) : '';
    if (ccEl && station && station.countryCode) ccEl.textContent = station.countryCode;
  }

  // --- list rendering --------------------------------------------------------------------

  function applyVisibility() {
    const base = hifiOn ? filterPlayable(stations) : stations;
    visible = filterStations(base, filterInput ? filterInput.value : '');
    if (countEl) countEl.textContent = `${visible.length} STATIONS`;
  }

  function renderList() {
    applyVisibility();
    if (!listEl) return;
    listEl.innerHTML = '';
    visible.forEach((station, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'radio-row' + (station.id === activeId ? ' is-active' : '') + (station.playable ? '' : ' is-unplayable');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', station.id === activeId ? 'true' : 'false');
      if (selected === index) row.classList.add('is-selected');

      const num = document.createElement('span');
      num.className = 'radio-row__num';
      num.textContent = `${String(index + 1).padStart(2, '0')}.`;
      const playMark = document.createElement('span');
      playMark.className = 'radio-row__mark';
      playMark.textContent = station.id === activeId && !isPaused ? '▶' : '·';
      const name = document.createElement('span');
      name.className = 'radio-row__name';
      name.textContent = station.name;
      const codec = document.createElement('span');
      codec.className = 'radio-row__codec';
      codec.textContent = station.playable
        ? [station.codec, station.bitrate ? `${station.bitrate}k` : ''].filter(Boolean).join(' ')
        : 'no-https';

      row.append(playMark, num, name, codec);
      if (station.playable) {
        row.addEventListener('click', () => tune(station));
      } else {
        row.disabled = true;
        row.title = 'http-only stream — blocked on https sites. Toggle [Hi-Fi] off to reveal.';
      }
      listEl.appendChild(row);
    });
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'radio-empty';
      empty.textContent = hifiOn && stations.length
        ? 'No https stations match — toggle Hi-Fi off to see http-only signals.'
        : 'Nothing matches this filter.';
      listEl.appendChild(empty);
    }
  }

  // --- tuning -------------------------------------------------------------------------------

  function tune(station) {
    if (!station || !station.playable) return;
    activeId = station.id;
    currentStation = station;
    isPaused = false;
    ensureSpectrum();
    renderNowPlaying();
    setStatus('▸ TUNING…');
    audio.src = station.streamUrl;
    audio.volume = Number(volumeInput ? volumeInput.value : 70) / 100;
    audio.play().then(() => {
      setStatus('▸ Playing', true);
      renderList();
    }).catch(() => {
      setStatus('■ Off Air');
      if (metaEl) metaEl.textContent = 'signal lost — the stream refused to open';
    });
  }

  function pauseToggle() {
    if (!activeId) return;
    if (isPaused) {
      audio.play().then(() => {
        isPaused = false;
        setStatus('▸ Playing', true);
        updatePlayButton();
        ensureSpectrum();
        renderList();
      }).catch(() => setStatus('■ Off Air'));
    } else {
      audio.pause();
      isPaused = true;
      setStatus('❚❚ Paused');
      updatePlayButton();
      renderList();
    }
  }

  // Pause-only transport: the stream stays bound to the audio element; pause
  // holds it, play resumes it. No stop flow (removed with the Stop button).

  function updatePlayButton() {
    if (!playBtn) return;
    playBtn.textContent = isPaused ? '▶ PLAY' : '❚❚ PAUSE';
    playBtn.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
  }
  const audio = root.querySelector('[data-radio-audio]');
  audio.addEventListener('playing', () => {
    setStatus('▸ Playing', true);
    renderList();
  });
  audio.addEventListener('error', () => {
    if (!activeId || !audio.src) return;
    setStatus('■ Off Air');
    // One silent retry, then honest off-air.
    const station = stations.find((s) => s.id === activeId);
    if (station) {
      audio.src = station.streamUrl;
      audio.play().catch(() => {});
    }
  });

  if (playBtn) playBtn.addEventListener('click', pauseToggle);
  if (volumeInput) volumeInput.addEventListener('input', () => {
    audio.volume = Number(volumeInput.value) / 100;
  });

  // --- browser row -----------------------------------------------------------------------------
  // (region/country dropdowns are built further down with the custom listbox engine)

  // --- custom terminal dropdowns (downward-only listboxes) ---------------------
  // One generic engine, two instances (region, country). Keyboard: ↑↓ move the
  // cursor, ↵ picks, Esc closes; click picks; click-outside closes.

  const dropdowns = [];

  function createDropdown({ trigger, listbox, valueEl, options, onPick, defaultLabel }) {
    let open = false;
    let cursor = -1;
    let current = options.length ? options[0].value : null;

    const close = () => {
      open = false;
      listbox.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-activedescendant', '');
      document.removeEventListener('pointerdown', onOutside, true);
    };

    const onOutside = (event) => {
      if (!open) return;
      if (listbox.contains(event.target) || trigger.contains(event.target)) return;
      close();
    };

    const renderOptions = () => {
      listbox.innerHTML = '';
      options.forEach((opt, i) => {
        const li = document.createElement('li');
        li.id = `${listbox.id}-opt-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', opt.value === current ? 'true' : 'false');
        li.classList.toggle('is-cursor', i === cursor);
        const label = document.createElement('span');
        label.textContent = opt.label;
        li.appendChild(label);
        if (opt.count !== undefined) {
          const count = document.createElement('span');
          count.className = 'radio-listbox__count';
          count.textContent = String(opt.count);
          li.appendChild(count);
        }
        li.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          pick(opt);
        });
        listbox.appendChild(li);
      });
    };

    const moveCursor = (delta) => {
      if (!options.length) return;
      cursor = Math.max(0, Math.min(options.length - 1, cursor === -1 ? 0 : cursor + delta));
      renderOptions();
      const row = listbox.children[cursor];
      if (row) {
        row.scrollIntoView({ block: 'nearest' });
        trigger.setAttribute('aria-activedescendant', row.id);
      }
    };

    const pick = (opt) => {
      current = opt.value;
      valueEl.textContent = opt.label;
      close();
      onPick(opt);
    };

    const openList = () => {
      open = true;
      cursor = options.findIndex((o) => o.value === current);
      renderOptions();
      listbox.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', onOutside, true);
      const row = listbox.children[Math.max(0, cursor)];
      if (row) row.scrollIntoView({ block: 'nearest' });
    };

    trigger.addEventListener('click', () => (open ? close() : openList()));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!open) openList(); else moveCursor(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (open) moveCursor(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (open && cursor >= 0 && options[cursor]) pick(options[cursor]);
      } else if (event.key === 'Escape') {
        if (open) { event.stopPropagation(); close(); }
      }
    });

    return {
      set(value) {
        const opt = options.find((o) => o.value === value);
        if (opt) current = opt.value;
        valueEl.textContent = opt ? opt.label : defaultLabel;
      },
      setOptions(next) {
        options = next;
        const stillThere = options.find((o) => o.value === current);
        if (!stillThere && options.length) {
          current = options[0].value;
          valueEl.textContent = options[0].label;
        } else if (!options.length) {
          valueEl.textContent = defaultLabel;
        }
        if (open) renderOptions();
      },
      get value() { return current; },
      close,
    };
  }

  const regionDropdown = createDropdown({
    trigger: regionTrigger,
    listbox: regionListbox,
    valueEl: regionValue,
    options: [],
    defaultLabel: '—',
    onPick: (opt) => {
      rebuildCountryOptions(opt.value);
      const first = countryOptions[0];
      if (first) {
        countryDropdown.set(first.value);
        loadCountry(first.value);
      }
    },
  });

  const countryDropdown = createDropdown({
    trigger: countryTrigger,
    listbox: countryListbox,
    valueEl: countryValue,
    options: [],
    defaultLabel: '—',
    onPick: (opt) => loadCountry(opt.value),
  });

  let languageCodes = new Set(); // codes playing has used recently (repeat avoidance)

  const languageDropdown = createDropdown({
    trigger: languageTrigger,
    listbox: languageListbox,
    valueEl: languageValue,
    options: [],
    defaultLabel: 'English',
    onPick: () => {},
  });

  const RANDOM_ATTEMPTS = 3;

  async function luckyDial() {
    const code = (languageDropdown.value || 'en').toLowerCase();
    setStatus('▸ TUNING… — spinning the dial…');
    try {
      // The directory's server-side language filter is fuzzy (it leaks stations
      // with other/empty languagecodes) and its random order is cached, so we
      // fetch a larger unfiltered pool with a cache-buster and verify the
      // language codes locally before drawing.
      const bust = Date.now();
      const url = `${API_BASE}/stations/search?hidebroken=true&order=random&limit=300&_=${bust}`;
      const rows = await (await fetch(url)).json();
      const pool = rows
        .map((r) => normalizeStation(r, 'directory'))
        .filter((s) => s && s.playable && (s.languagecodes || []).includes(code));
      if (!pool.length) {
        setStatus('■ Off Air');
        if (metaEl) metaEl.textContent = `no https ${languageDropdown.value || 'english'} stations in this draw — spin again`;
        return;
      }
      // Try up to N draws, avoiding stations we recently dialed.
      for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
        const pick = pickRandomStation(pool, languageCodes);
        if (!pick) break;
        languageCodes.add(pick.id);
        if (languageCodes.size > 12) languageCodes.delete(languageCodes.values().next().value);
        tune(pick);
        backfillBrowser(pick);
        return;
      }
      const fallback = pickRandomStation(pool, new Set());
      if (fallback) { tune(fallback); backfillBrowser(fallback); }
    } catch {
      setStatus('■ OFFLINE');
      if (metaEl) metaEl.textContent = 'could not reach the station directory';
    }
  }

  async function fillLanguageDropdown() {
    try {
      let rows = readCachedLanguages(localStorage);
      if (!rows) {
        rows = await fetchLanguages();
        writeCachedLanguages(localStorage, rows);
      }
      const opts = rows
        .filter((l) => l.stationcount >= 20)
        .sort((a, b) => b.stationcount - a.stationcount)
        .map((l) => ({
          value: (l.iso_639_1 || l.iso_639 || l.name.toLowerCase()).toLowerCase(),
          label: cap(l.name),
          count: l.stationcount,
        }));
      languageDropdown.setOptions(opts);
      languageDropdown.set('en');
    } catch {
      // Lucky dial stays on English if the languages endpoint is shy.
    }
  }

  function cap(word) {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  }

  if (randomBtn) randomBtn.addEventListener('click', luckyDial);

  /** After a lucky-dial tune, follow the browser panel to the station's home:
   *  region dropdown → its region, country dropdown → its country. Labels
   *  only — the station list is NOT reloaded (that would kill playback). */
  function backfillBrowser(station) {
    if (!station || !regions || !station.countryCode) return;
    const region = regions.regionFor(station.countryCode);
    regionDropdown.set(region);
    rebuildCountryOptions(region);
    countryDropdown.set(station.countryCode);
  }

  function fillRegionDropdown() {
    if (!regions) return;
    const opts = [...regions.REGION_NAMES, 'Other'].map((name) => ({ value: name, label: name.toUpperCase() }));
    regionDropdown.setOptions(opts);
    regionDropdown.set(DEFAULT_REGION);
  }

  function rebuildCountryOptions(regionFilter) {
    const byRegion = new Map();
    for (const row of countriesRows) {
      if (!row.stationcount) continue;
      const region = regions.regionFor(row.iso_3166_1);
      if (regionFilter && region !== regionFilter) continue;
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region).push({ name: row.name, code: row.iso_3166_1, count: row.stationcount });
    }
    const opts = [];
    for (const region of byRegion.keys()) {
      for (const country of byRegion.get(region).sort((a, b) => b.count - a.count)) {
        opts.push({ value: country.code, label: country.name, count: country.count });
      }
    }
    countryOptions = opts;
    countryDropdown.setOptions(opts);
  }

  async function loadCountry(code) {
    const seq = ++fetchSeq;
    setStatus('▸ LOADING…');
    try {
      const url = `${API_BASE}/stations/search?countrycode=${encodeURIComponent(code)}&hidebroken=true&order=votes&reverse=true&limit=500`;
      const rows = await (await fetch(url)).json();
      if (seq !== fetchSeq) return;
      stations = rows.map((r) => normalizeStation(r, 'directory')).filter(Boolean);
      activeId = null;
      currentStation = null;
      isPaused = false;
      renderNowPlaying();
      renderList();
      const cc = (rows[0] && rows[0].countrycode) || code;
      if (ccEl) ccEl.textContent = cc;
      setStatus('■ Off Air');
    } catch {
      if (seq !== fetchSeq) return;
      setStatus('■ OFFLINE');
      if (listEl) listEl.innerHTML = '<p class="radio-empty">Could not reach the station directory — reload to retry.</p>';
    }
  }

  let filterDebounce = null;
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      if (filterDebounce) clearTimeout(filterDebounce);
      filterDebounce = setTimeout(renderList, 120);
    });
  }

  if (hifiBtn) {
    const setHifi = (on) => {
      hifiOn = on;
      hifiBtn.setAttribute('aria-checked', on ? 'true' : 'false');
      renderList();
    };
    hifiBtn.addEventListener('click', () => setHifi(!hifiOn));
    setHifi(true);
  }

  // --- keybinds ---------------------------------------------------------------------------------

  function moveSelection(delta) {
    if (!visible.length) return;
    selected = Math.max(0, Math.min(visible.length - 1, selected === -1 ? 0 : selected + delta));
    renderList();
    const row = listEl ? listEl.children[selected] : null;
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', (event) => {
    const inFilter = document.activeElement === filterInput;
    if (event.key === '/' && !inFilter) {
      event.preventDefault();
      filterInput && filterInput.focus();
      return;
    }
    if (event.key === 'Escape' && inFilter) {
      filterInput.blur();
      return;
    }
    if (inFilter) return; // all other binds suppressed while typing
    switch (event.key) {
      case ' ':
        event.preventDefault();
        pauseToggle();
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveSelection(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveSelection(-1);
        break;
      case 'Enter': {
        event.preventDefault();
        const target = visible[selected];
        if (target) tune(target);
        break;
      }
      case '+': case '=':
        if (volumeInput) {
          volumeInput.value = String(Math.min(100, Number(volumeInput.value) + 5));
          audio.volume = Number(volumeInput.value) / 100;
        }
        break;
      case '-':
        if (volumeInput) {
          volumeInput.value = String(Math.max(0, Number(volumeInput.value) - 5));
          audio.volume = Number(volumeInput.value) / 100;
        }
        break;
      case 'h': case 'H':
        hifiBtn && hifiBtn.click();
        break;
      default:
        break;
    }
  });

  // --- boot ---------------------------------------------------------------------------------------

  startSpectrum();
  fillRegionDropdown();
  fillLanguageDropdown();
  renderNowPlaying();
  setStatus('■ Off Air');
  updatePlayButton();

  (async () => {
    try {
      let rows = readCachedCountries(localStorage);
      if (!rows) {
        rows = await fetchCountries();
        writeCachedCountries(localStorage, rows);
      }
      countriesRows = rows;
      rebuildCountryOptions(DEFAULT_REGION);
      // Default to the UK when present (Dadbot's home dial), else the first
      // country of the default region.
      const gb = countryOptions.find((o) => o.value === 'GB');
      const chosen = gb || countryOptions[0];
      if (chosen) {
        countryDropdown.set(chosen.value);
        if (ccEl) ccEl.textContent = chosen.value;
        await loadCountry(chosen.value);
      }
    } catch {
      setStatus('■ OFFLINE');
      if (listEl) listEl.innerHTML = '<p class="radio-empty">Could not reach the station directory — reload to retry.</p>';
    }
  })();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRadioDesk);
  } else {
    initRadioDesk();
  }
}
