// Client-only. MapLibre is imported lazily so it never blocks first paint.
// All data-derived text is set with textContent; nothing from reports/news ever goes through innerHTML.
import type { Map as MLMap, GeoJSONSource, Popup, Marker } from 'maplibre-gl';
import type { ReportView } from './data';
import type { Source } from './types';

const STYLE_URL = import.meta.env.PUBLIC_MAP_STYLE_URL as string | undefined;

// Default: OSM raster tiles — fine for development and low traffic only.
// For production set PUBLIC_MAP_STYLE_URL to a hosted style (see README).
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

/** Marker colours (the basemap is always light). Shape differs per source too, so colour is never the only cue. */
export const MARKER: Record<Source, { color: string; shape: 'square' | 'diamond' | 'circle' }> = {
  government: { color: '#2f45c0', shape: 'square' },
  news: { color: '#b45309', shape: 'diamond' },
  community: { color: '#0f766e', shape: 'circle' },
};

export interface MapStrings {
  source: Record<Source, string>;
  unverified: string;
  flagged: string;
  approximate: string;
  provinceLevel: string;
  sourcePrefix: string;
  newTab: string;
  inThai: string;
  locate: string;
  locating: string;
  noGeo: string;
  denied: string;
  geoFail: string;
  here: string; // "{n} items…"
  cluster: string;
  failed?: string;
}

export interface MapOptions {
  items?: ReportView[];
  strings?: MapStrings;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  onPick?: (lng: number, lat: number) => void;
  onSelect?: (id: string) => void;
}

export interface MapHandle {
  map: MLMap;
  setFilter: (src: Source | 'all') => void;
  focus: (id: string) => void;
  pick: (lng: number, lat: number) => void;
}

// Load MapLibre's stylesheet only when a map is created (a static CSS import would be render-blocking).
let cssPromise: Promise<void> | undefined;
function loadCss() {
  return (cssPromise ??= import('maplibre-gl/dist/maplibre-gl.css?url').then(
    ({ default: href }) =>
      new Promise<void>((resolve) => {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.onload = l.onerror = () => resolve();
        document.head.append(l);
      }),
  ));
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function popupContent(r: ReportView, s: MapStrings): HTMLElement {
  const box = el('div', 'map-popup');
  const top = el('div', 'pp-top');
  const badge = el('span', `pp-src ${r.source}`, s.source[r.source]);
  top.append(badge);
  if (r.unverified) top.append(el('span', 'pp-flag', s.unverified));
  if (r.flagged) top.append(el('span', 'pp-flag', s.flagged));
  box.append(top);

  const h = el('strong', 'pp-title', r.title);
  if (r.titleLang) h.lang = r.titleLang;
  box.append(h);
  box.append(el('div', 'pp-meta', `${r.icon} ${r.typeLabel} · ${r.provinceName} · ${r.when}`));
  if (r.metrics) box.append(el('div', 'pp-metric', r.metrics));
  if (r.description) {
    const d = el('p', 'pp-desc', r.description);
    if (r.descLang) d.lang = r.descLang;
    box.append(d);
  }
  if (r.precision !== 'exact') box.append(el('div', 'pp-note', r.precision === 'province' ? s.provinceLevel : s.approximate));
  if (r.refs.length) {
    const ul = el('ul', 'pp-refs');
    for (const ref of r.refs) {
      if (!/^https?:\/\//i.test(ref.url)) continue;
      const li = el('li');
      const a = el('a');
      a.href = ref.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.append(el('span', 'pp-refp', `${s.sourcePrefix} `), document.createTextNode(`${ref.name} ↗`), el('span', 'sr-only', ` ${s.newTab}`));
      li.append(a);
      ul.append(li);
    }
    box.append(ul);
  }
  return box;
}

function listContent(items: ReportView[], s: MapStrings, open: (r: ReportView) => void): HTMLElement {
  const box = el('div', 'map-popup');
  box.append(el('strong', 'pp-title', s.here.replace('{n}', String(items.length))));
  const ul = el('ul', 'pp-list');
  for (const r of items) {
    const li = el('li');
    const b = el('button', 'pp-item');
    b.type = 'button';
    b.append(el('span', `pp-src ${r.source}`, s.source[r.source]), el('span', 'pp-item-t', r.title));
    b.onclick = () => open(r);
    li.append(b);
    ul.append(li);
  }
  box.append(ul);
  return box;
}

/** Draws one marker image per source (2x for crisp rendering). */
function markerImage(src: Source) {
  const { color, shape } = MARKER[src];
  const S = 48;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(S / 2, S / 2);
  const path = () => {
    g.beginPath();
    if (shape === 'circle') g.arc(0, 0, 13, 0, Math.PI * 2);
    else if (shape === 'diamond') { g.moveTo(0, -17); g.lineTo(17, 0); g.lineTo(0, 17); g.lineTo(-17, 0); g.closePath(); }
    else g.roundRect(-13, -13, 26, 26, 5);
  };
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 1;
  path();
  g.fillStyle = color;
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 4;
  g.strokeStyle = '#fff';
  g.stroke();
  // inner mark adds a second non-colour cue
  g.fillStyle = '#fff';
  g.beginPath();
  if (src === 'government') g.rect(-4, -4, 8, 8);
  else if (src === 'news') { g.moveTo(0, -5); g.lineTo(5, 0); g.lineTo(0, 5); g.lineTo(-5, 0); g.closePath(); }
  else g.arc(0, 0, 3.5, 0, Math.PI * 2);
  g.fill();
  return g.getImageData(0, 0, S, S);
}

/** Shared lazy MapLibre setup (style, controls, cooperative gestures). Used by every map on the site. */
export async function baseMap(container: HTMLElement, view: { center?: [number, number]; zoom?: number; bounds?: [number, number, number, number] } = {}) {
  const [{ default: maplibregl }] = await Promise.all([import('maplibre-gl'), loadCss()]);
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL || OSM_STYLE,
    ...(view.center
      ? { center: view.center, zoom: view.zoom ?? 8 }
      : { bounds: view.bounds ?? ([97.3, 5.6, 105.7, 20.5] as [number, number, number, number]), fitBoundsOptions: { padding: 24 } }),
    attributionControl: { compact: true },
    cooperativeGestures: true, // two-finger pan on mobile so the page can still scroll
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  return { maplibregl, map };
}

export async function createMap(container: HTMLElement, opts: MapOptions = {}): Promise<MapHandle> {
  const { maplibregl, map } = await baseMap(container, { center: opts.center, zoom: opts.zoom });
  const s = opts.strings;

  const handle: MapHandle = { map, setFilter: () => {}, focus: () => {}, pick: () => {} };

  // "Go to my location" button (not on the report picker, which has its own GPS button).
  if (!opts.onPick && s) {
    const note = (text: string) => {
      container.parentElement?.querySelector('.map-note')?.remove();
      const n = el('div', 'map-note', text);
      n.setAttribute('role', 'status');
      container.parentElement?.append(n);
      setTimeout(() => n.remove(), 5000);
    };
    let me: Marker | undefined;
    const group = el('div', 'maplibregl-ctrl maplibregl-ctrl-group');
    const btn = el('button', 'locate-btn');
    btn.type = 'button';
    btn.title = s.locate;
    btn.setAttribute('aria-label', s.locate);
    // static icon markup only (no data)
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d2b36" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
    btn.onclick = () => {
      if (!navigator.geolocation) return note(s.noGeo);
      btn.disabled = true;
      btn.classList.add('busy');
      btn.setAttribute('aria-busy', 'true');
      const done = () => { btn.disabled = false; btn.classList.remove('busy'); btn.removeAttribute('aria-busy'); };
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          done();
          const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          me ??= new maplibregl.Marker({ element: el('div', 'me-dot') });
          me.setLngLat(c).addTo(map);
          map.flyTo({ center: c, zoom: 11 });
        },
        (err) => { done(); note(err.code === 1 ? s.denied : s.geoFail); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    };
    group.append(btn);
    map.addControl({ onAdd: () => group, onRemove: () => group.remove() }, 'top-right');
  }

  if (opts.items && s) {
    const all = opts.items;
    const byId = new Map(all.map((r) => [r.id, r]));
    const toGeo = (list: ReportView[]) => ({
      type: 'FeatureCollection' as const,
      features: list.map((r) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
        properties: { id: r.id, src: r.source, approx: r.precision !== 'exact' ? 1 : 0 },
      })),
    });
    let popup: Popup | undefined;
    let filter: Source | 'all' = 'all';
    const visible = () => (filter === 'all' ? all : all.filter((r) => r.source === filter));

    const select = (id: string | null) => {
      if (map.getLayer('selected')) map.setFilter('selected', ['==', ['get', 'id'], id ?? '']);
    };
    const openPopup = (r: ReportView, notify = true) => {
      popup?.remove();
      popup = new maplibregl.Popup({ offset: 16, maxWidth: '300px', focusAfterOpen: false })
        .setLngLat([r.lng, r.lat])
        .setDOMContent(popupContent(r, s))
        .addTo(map);
      popup.on('close', () => select(null));
      select(r.id);
      if (notify) opts.onSelect?.(r.id);
    };
    const openList = (items: ReportView[], at: [number, number]) => {
      popup?.remove();
      popup = new maplibregl.Popup({ offset: 16, maxWidth: '300px' }).setLngLat(at).setDOMContent(listContent(items, s, (r) => openPopup(r))).addTo(map);
    };

    // Cluster bubbles are real <button>s, so they are keyboard reachable and labelled.
    const clusterMarkers = new Map<number, Marker>();
    const updateClusters = () => {
      if (!map.getSource('reports')) return;
      const seen = new Set<number>();
      for (const f of map.querySourceFeatures('reports', { filter: ['has', 'point_count'] })) {
        const id = Number(f.properties?.cluster_id);
        if (seen.has(id)) continue;
        seen.add(id);
        if (clusterMarkers.has(id)) continue;
        const n = Number(f.properties?.point_count);
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const b = el('button', `cluster ${n >= 50 ? 'l' : n >= 10 ? 'm' : 's'}`, String(n));
        b.type = 'button';
        b.setAttribute('aria-label', s.cluster.replace('{n}', String(n)));
        b.onclick = async (ev) => {
          ev.stopPropagation();
          const src = map.getSource('reports') as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(id);
          if (zoom > 12 || map.getZoom() >= 12) {
            const leaves = (await src.getClusterLeaves(id, 50, 0)) as GeoJSON.Feature[];
            openList(leaves.map((l) => byId.get(String(l.properties?.id))!).filter(Boolean), coords);
          } else map.easeTo({ center: coords, zoom });
        };
        clusterMarkers.set(id, new maplibregl.Marker({ element: b }).setLngLat(coords).addTo(map));
      }
      for (const [id, m] of clusterMarkers) if (!seen.has(id)) { m.remove(); clusterMarkers.delete(id); }
    };
    const resetClusters = () => { for (const m of clusterMarkers.values()) m.remove(); clusterMarkers.clear(); };

    let ready = false;
    let pendingFocus: string | undefined;
    map.on('load', () => {
      for (const src of Object.keys(MARKER) as Source[]) map.addImage(`m-${src}`, markerImage(src), { pixelRatio: 2 });
      map.addSource('reports', { type: 'geojson', data: toGeo(visible()), cluster: true, clusterRadius: 44, clusterMaxZoom: 12 });
      map.addLayer({
        id: 'approx', type: 'circle', source: 'reports', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'approx'], 1]],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 14, 10, 34],
          'circle-color': ['match', ['get', 'src'], 'government', MARKER.government.color, 'news', MARKER.news.color, MARKER.community.color],
          'circle-opacity': 0.14,
        },
      });
      map.addLayer({
        id: 'selected', type: 'circle', source: 'reports', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 19, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 3, 'circle-stroke-color': '#0c2230' },
      });
      map.addLayer({
        id: 'points', type: 'symbol', source: 'reports', filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'm-', ['get', 'src']],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['match', ['get', 'src'], 'community', 3, 'news', 2, 1],
        },
      });
      map.on('click', 'points', (e) => {
        const ids = [...new Set((e.features ?? []).map((f) => String(f.properties?.id)))];
        const items = ids.map((id) => byId.get(id)!).filter(Boolean);
        if (items.length === 1) openPopup(items[0]);
        else if (items.length > 1) openList(items, [e.lngLat.lng, e.lngLat.lat]);
      });
      map.on('mouseenter', 'points', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'points', () => (map.getCanvas().style.cursor = ''));
      map.on('moveend', updateClusters);
      map.on('sourcedata', (e) => { if (e.sourceId === 'reports' && e.isSourceLoaded) updateClusters(); });
      ready = true;
      if (pendingFocus) handle.focus(pendingFocus);
    });

    handle.setFilter = (src) => {
      filter = src;
      popup?.remove();
      const g = map.getSource('reports') as GeoJSONSource | undefined;
      if (!g) return;
      resetClusters();
      g.setData(toGeo(visible())); // client-side only, no network
    };
    handle.focus = (id) => {
      const r = byId.get(id);
      if (!r) return;
      if (!ready) { pendingFocus = id; return; }
      pendingFocus = undefined;
      const zoom = Math.max(map.getZoom(), r.precision === 'exact' ? 14 : r.precision === 'approximate' ? 10 : 8.5);
      // Put the point in the lower part of the map so the popup (anchored above it) has room.
      const offset: [number, number] = [0, Math.round(container.clientHeight * 0.28)];
      if (reduced()) map.easeTo({ center: [r.lng, r.lat], zoom, offset, duration: 0 });
      else map.flyTo({ center: [r.lng, r.lat], zoom, offset, duration: 900 });
      map.once('moveend', () => openPopup(r, false));
    };
  }

  if (opts.onPick) {
    let marker: Marker | undefined;
    const place = (lng: number, lat: number) => {
      if (!marker) {
        marker = new maplibregl.Marker({ color: '#b3261e', draggable: true }).setLngLat([lng, lat]).addTo(map);
        marker.on('dragend', () => {
          const p = marker!.getLngLat();
          opts.onPick!(p.lng, p.lat);
        });
      }
      marker.setLngLat([lng, lat]);
      opts.onPick!(lng, lat);
    };
    map.on('click', (e) => place(e.lngLat.lng, e.lngLat.lat));
    handle.pick = place;
  }
  return handle;
}
