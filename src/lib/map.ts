// Client-only. MapLibre is imported lazily so it never blocks first paint.
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import { REPORT_TYPES, SYSTEM_TYPES, SOURCE_LABEL, typeById, type Report } from './types';
import { thaiDate } from './format';

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

export interface MapOptions {
  reports?: Report[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  onPick?: (lng: number, lat: number) => void;
}

const typeColor = ['match', ['get', 'type'], ...[...REPORT_TYPES, ...SYSTEM_TYPES].flatMap((t) => [t.id, t.color]), '#5f6b7a'];

function popupContent(r: Report): HTMLElement {
  const t = typeById(r.type);
  const box = document.createElement('div');
  box.className = 'map-popup';
  const h = document.createElement('strong');
  h.textContent = r.title ?? `${t.icon} ${t.label}`;
  const src = document.createElement('div');
  src.className = 'when';
  src.textContent = `${SOURCE_LABEL[r.source ?? 'community'].badge} · ${thaiDate(r.occurredAt)}`;
  box.append(h, src);
  if (r.description) {
    const d = document.createElement('p');
    d.textContent = r.description; // user/news content: textContent only, never innerHTML
    box.append(d);
  }
  if (r.locationPrecision && r.locationPrecision !== 'exact') {
    const n = document.createElement('small');
    n.textContent = 'ตำแหน่งโดยประมาณ';
    box.append(n);
  }
  for (const ref of r.references ?? []) {
    if (!/^https?:\/\//.test(ref.url)) continue;
    const a = document.createElement('a');
    a.href = ref.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `↗ ${ref.name}`;
    a.style.display = 'block';
    box.append(a);
  }
  if (r.source === 'community' || !r.source) {
    const s = document.createElement('small');
    s.textContent = 'ยังไม่ผ่านการตรวจสอบ';
    box.append(s);
  }
  return box;
}

export async function createMap(el: HTMLElement, opts: MapOptions = {}): Promise<MLMap> {
  const [{ default: maplibregl }] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ]);
  const map = new maplibregl.Map({
    container: el,
    style: STYLE_URL || OSM_STYLE,
    center: opts.center ?? [100.99, 13.0],
    zoom: opts.zoom ?? 5.2,
    attributionControl: { compact: true },
    cooperativeGestures: true, // two-finger pan on mobile so the page can still scroll
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  // "Go to my location" button (not on the report picker, which has its own GPS button).
  if (!opts.onPick) {
    const note = (text: string) => {
      const n = document.createElement('div');
      n.className = 'map-note';
      n.setAttribute('role', 'status');
      n.textContent = text;
      el.append(n);
      setTimeout(() => n.remove(), 5000);
    };
    let me: InstanceType<typeof maplibregl.Marker> | undefined;
    const group = document.createElement('div');
    group.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'locate-btn';
    btn.title = btn.ariaLabel = 'ไปยังตำแหน่งของฉัน';
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
    btn.onclick = () => {
      if (!navigator.geolocation) return note('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btn.disabled = false;
          const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          const dot = document.createElement('div');
          dot.className = 'me-dot';
          me ??= new maplibregl.Marker({ element: dot });
          me.setLngLat(c).addTo(map);
          map.flyTo({ center: c, zoom: 11, essential: true });
        },
        (err) => {
          btn.disabled = false;
          note(err.code === 1 ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์' : 'ไม่สามารถอ่านตำแหน่งของอุปกรณ์ได้');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    };
    group.append(btn);
    map.addControl({ onAdd: () => group, onRemove: () => group.remove() }, 'top-right');
  }

  if (opts.reports) {
    const byId = new Map(opts.reports.map((r) => [r.id, r]));
    const geo = {
      type: 'FeatureCollection' as const,
      features: opts.reports.map((r) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
        properties: { id: r.id, type: r.type },
      })),
    };
    map.on('load', () => {
      map.addSource('reports', { type: 'geojson', data: geo, cluster: true, clusterRadius: 44, clusterMaxZoom: 12 });
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'reports', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#0a5c8f', 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28], 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      });
      // Count labels need a style with `glyphs`; the default OSM raster style has none.
      if (map.getStyle().glyphs) {
        map.addLayer({
          id: 'cluster-count', type: 'symbol', source: 'reports', filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 },
          paint: { 'text-color': '#fff' },
        });
      }
      map.addLayer({
        id: 'points', type: 'circle', source: 'reports', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': typeColor as never, 'circle-radius': 8, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' },
      });
      map.on('click', 'clusters', async (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const zoom = await (map.getSource('reports') as GeoJSONSource).getClusterExpansionZoom(Number(f.properties?.cluster_id));
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on('click', 'points', (e) => {
        const f = e.features?.[0];
        const r = f && byId.get(String(f.properties?.id));
        if (!r) return;
        new maplibregl.Popup({ offset: 12, maxWidth: '260px' })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setDOMContent(popupContent(r))
          .addTo(map);
      });
      for (const layer of ['clusters', 'points']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
    });
  }

  if (opts.onPick) {
    let marker: InstanceType<typeof maplibregl.Marker> | undefined;
    const place = (lng: number, lat: number) => {
      marker ??= new maplibregl.Marker({ color: '#b3261e', draggable: true }).setLngLat([lng, lat]).addTo(map);
      marker.setLngLat([lng, lat]);
      marker.on('dragend', () => {
        const p = marker!.getLngLat();
        opts.onPick!(p.lng, p.lat);
      });
      opts.onPick!(lng, lat);
    };
    map.on('click', (e) => place(e.lngLat.lng, e.lngLat.lat));
    (map as unknown as { pick: typeof place }).pick = place;
  }
  return map;
}

export type PickableMap = MLMap & { pick?: (lng: number, lat: number) => void };
