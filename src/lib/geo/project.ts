import centroids from './au-postcode-centroids.json';
import type { PostcodeRow } from '../aggregate';

/** Equirectangular window that frames the Australian continent. */
export const AU_MAP = {
  west: 112.5,
  east: 154.5,
  north: -10,
  south: -44,
  width: 400,
  height: 360,
} as const;

const TABLE: Record<string, [number, number]> = centroids as Record<string, [number, number]>;

export function padPostcode(postcode: string): string {
  return postcode.trim().padStart(4, '0');
}

export function postcodeCentroid(postcode: string): { lat: number; lng: number } | null {
  const row = TABLE[padPostcode(postcode)] ?? TABLE[postcode.trim()];
  if (!row) return null;
  return { lat: row[0], lng: row[1] };
}

export function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - AU_MAP.west) / (AU_MAP.east - AU_MAP.west)) * AU_MAP.width;
  const y = ((AU_MAP.north - lat) / (AU_MAP.north - AU_MAP.south)) * AU_MAP.height;
  return { x, y };
}

export interface MapDot {
  postcode: string;
  x: number;
  y: number;
  enquiries: number;
  contracts: number;
  r: number;
}

export function locationTableRows(postcodes: PostcodeRow[], max = 10): PostcodeRow[] {
  return postcodes.slice(0, Math.min(10, Math.max(0, max)));
}

export function mapDots(postcodes: PostcodeRow[], max = 10): MapDot[] {
  const rows = locationTableRows(postcodes, max);
  const weights = rows.map((r) => Math.max(r.contracts, r.enquiries * 0.25, 1));
  const maxW = Math.max(...weights, 1);
  const dots: MapDot[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const c = postcodeCentroid(row.postcode);
    if (!c) continue;
    const { x, y } = projectLatLng(c.lat, c.lng);
    const r = 4 + (weights[i] / maxW) * 8;
    dots.push({
      postcode: row.postcode,
      x,
      y,
      enquiries: row.enquiries,
      contracts: row.contracts,
      r,
    });
  }
  return dots;
}
