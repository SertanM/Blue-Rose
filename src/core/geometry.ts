import { CFG } from './config';
import type { Arrow, ArrowHead, Card, CardTypeId, Rect, Vec } from './types';
import { isGroupType } from '../cards/registry';

/** Çakışma hesabı için gereken en küçük kart bilgisi (tür ve grup başlık yüksekliği). */
export type Box = Rect & { type?: CardTypeId; hh?: number };

/* ─────────────── Saf geometri (DOM yok) ─────────────── */
const rings: Vec[][] = [];
export const Geo = {
  snap: (v: number) => Math.round(v / CFG.GRID) * CFG.GRID,
  snapRect: (r: Rect): Rect => ({ x: Geo.snap(r.x), y: Geo.snap(r.y), w: Math.max(CFG.MIN_W, Geo.snap(r.w)), h: Math.max(CFG.MIN_H, Geo.snap(r.h)) }),
  hit: (a: Rect, b: Rect, g: number = CFG.GAP) => a.x < b.x + b.w + g && a.x + a.w + g > b.x && a.y < b.y + b.h + g && a.y + a.h + g > b.y,
  /** Kart, grubun içerik alanına tamamen sığıyorsa grubun "çocuğu"dur. */
  contains: (g: Box, c: Rect) => isGroupType(g.type) && g !== c && c.x >= g.x && c.y >= g.y + (g.hh ?? 0) && c.x + c.w <= g.x + g.w && c.y + c.h <= g.y + g.h,
  /** Çakışma: iki kart üst üste biniyor ve biri diğerinin çocuğu değil. */
  collide: (a: Box, b: Box) => !Geo.contains(a, b) && !Geo.contains(b, a) && Geo.hit(a, b),
  center: (c: Rect): Vec => [c.x + c.w / 2, c.y + c.h / 2],
  /** Kartın kenarında, (tx,ty) noktasına bakan kesişim noktası. */
  edge(c: Rect, tx: number, ty: number): Vec {
    const [cx, cy] = Geo.center(c), dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    const s = Math.min((c.w / 2) / Math.abs(dx || 1e-9), (c.h / 2) / Math.abs(dy || 1e-9));
    return [cx + dx * s, cy + dy * s];
  },
  /** r. halkadaki ızgara kaydırmaları, merkeze en yakın olandan başlayarak (önbellekli). */
  ring(r: number): Vec[] {
    return rings[r] ??= (() => {
      const out: Vec[] = [];
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) out.push([i, j]);
      return out.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);
    })();
  },
};

/** Izgara tabanlı çakışma dizini: n kart arasında çakışma sorgusu ~O(1). */
export class SpatialIndex {
  private buckets = new Map<string, Box[]>();
  constructor(rects: Box[], private cell = 240) {
    for (const r of rects) for (const k of this.keys(r, 0)) (this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!).push(r);
  }
  private keys(r: Rect, pad: number) {
    const c = this.cell, keys: string[] = [];
    for (let i = Math.floor((r.x - pad) / c); i <= Math.floor((r.x + r.w + pad) / c); i++)
      for (let j = Math.floor((r.y - pad) / c); j <= Math.floor((r.y + r.h + pad) / c); j++) keys.push(i + ',' + j);
    return keys;
  }
  collides(r: Box) {
    for (const k of this.keys(r, CFG.GAP)) for (const o of this.buckets.get(k) ?? []) if (Geo.collide(r, o)) return true;
    return false;
  }
}

/** (0,0) boşsa orada kal; değilse en yakın boş ızgara kaydırmasını bul. `accepts` sırayla denenen tercih filtreleridir. */
export function nearestFree(blocked: (dx: number, dy: number) => boolean, accepts: ((dx: number, dy: number) => boolean)[] = [() => true], maxRing = 120): Vec {
  if (!blocked(0, 0)) return [0, 0];
  for (const accept of accepts)
    for (let r = 1; r < maxRing; r++)
      for (const [i, j] of Geo.ring(r)) {
        const dx = i * CFG.GRID, dy = j * CFG.GRID;
        if (!blocked(dx, dy) && accept(dx, dy)) return [dx, dy];
      }
  return [0, 0];
}

export interface ArrowEnds { a1: Vec; a2: Vec; C: Vec | null; p1: Vec; p2: Vec }

/** Okun iki ucu (kart kenarına oturmuş) ve eğri kontrol noktası. */
export function arrowEnds(ar: Arrow, cardMap: Map<string, Card>): ArrowEnds {
  const A = ar.a ? cardMap.get(ar.a) : undefined, B = ar.b ? cardMap.get(ar.b) : undefined;
  const a1: Vec = A ? Geo.center(A) : [ar.x1, ar.y1], a2: Vec = B ? Geo.center(B) : [ar.x2, ar.y2];
  const C: Vec | null = (ar.bx || ar.by) ? [(a1[0] + a2[0]) / 2 + (ar.bx || 0), (a1[1] + a2[1]) / 2 + (ar.by || 0)] : null;
  return {
    a1, a2, C,
    p1: A ? Geo.edge(A, ...(C || a2)) : [ar.x1, ar.y1],
    p2: B ? Geo.edge(B, ...(C || a1)) : [ar.x2, ar.y2],
  };
}

/** İkinci dereceden Bezier üzerindeki nokta (C yoksa düz çizgi). */
export function quadAt(p1: Vec, p2: Vec, C: Vec | null, t: number): Vec {
  const cx = C ? C[0] : (p1[0] + p2[0]) / 2, cy = C ? C[1] : (p1[1] + p2[1]) / 2, u = 1 - t;
  return [u * u * p1[0] + 2 * u * t * cx + t * t * p2[0], u * u * p1[1] + 2 * u * t * cy + t * t * p2[1]];
}

export interface ArrowShape { line: string; startHead: string | null; endHead: string | null; mid: Vec; delAt: Vec; labelPath: string }

/** Okun çizim şekli: çizgi, ok başları, orta nokta, silme düğmesi ve etiket konumu. */
export function arrowGeometry([x1, y1]: Vec, [x2, y2]: Vec, C: Vec | null, w: number, head: ArrowHead): ArrowShape {
  const L = 7 + w * 2.2, Wd = 4 + w * 1.6;
  const dir = (px: number, py: number, qx: number, qy: number): Vec => { const dx = px - qx, dy = py - qy, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const tri = (x: number, y: number, u: Vec) => { const bx = x - u[0] * L, by = y - u[1] * L; return `M${x} ${y}L${bx - u[1] * Wd} ${by + u[0] * Wd}L${bx + u[1] * Wd} ${by - u[0] * Wd}Z`; };
  const dE = C ? dir(x2, y2, C[0], C[1]) : dir(x2, y2, x1, y1), dS = C ? dir(x1, y1, C[0], C[1]) : dir(x1, y1, x2, y2);
  let lx1 = x1, ly1 = y1, lx2 = x2, ly2 = y2, startHead: string | null = null, endHead: string | null = null;
  if (head === 'end' || head === 'both') { endHead = tri(x2, y2, dE); lx2 = x2 - dE[0] * L * .7; ly2 = y2 - dE[1] * L * .7; }
  if (head === 'start' || head === 'both') { startHead = tri(x1, y1, dS); lx1 = x1 - dS[0] * L * .7; ly1 = y1 - dS[1] * L * .7; }
  const line = C ? `M${lx1} ${ly1}Q${C[0]} ${C[1]} ${lx2} ${ly2}` : `M${lx1} ${ly1}L${lx2} ${ly2}`;
  const at = (t: number) => quadAt([x1, y1], [x2, y2], C, t);
  // Etiket okun (eğik ya da eğri) yolunu izler; ok sola gidiyorsa yol ters çevrilir ki yazı hiçbir zaman ters durmasın.
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, reversed = angle > 90 || angle < -90;
  const labelPath = !reversed ? line : (C ? `M${lx2} ${ly2}Q${C[0]} ${C[1]} ${lx1} ${ly1}` : `M${lx2} ${ly2}L${lx1} ${ly1}`);
  return { line, startHead, endHead, mid: at(.5), delAt: at(.74), labelPath };
}
