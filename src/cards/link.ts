import { COLORS } from '../core/config';
import type { Card } from '../core/types';
import { CTL, h } from './dom';
import type { BodyContext, CardTypeDef } from './registry';

/* ── saf yardımcılar (test edilir) ── */

/** Kullanıcının yazdığı adresi düzeltir: şema yoksa https eklenir; yalnızca http(s) kabul edilir. */
export function normalizeUrl(input: string): string | null {
  const s = input.trim(); if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}
export const domainOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Küçük resim: YouTube videoları ve doğrudan görsel bağlantıları (internet varsa yüklenir). */
export function thumbOf(url: string): string | null {
  let u: URL; try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^(www|m)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com') id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
  if (id && /^[\w-]{6,}$/.test(id)) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(u.pathname) ? u.href : null;
}

export const LINK_SIZE: [number, number] = [288, 144];
export const LINK_SIZE_THUMB: [number, number] = [288, 336];

/* ── kart ── */

/** Bağlantıyı yeni sekmede açar (yalnızca http/https). */
const open = (url: string | undefined) => { const u = url && normalizeUrl(url); if (u) window.open(u, '_blank', 'noopener,noreferrer'); };

function renderBody(body: HTMLElement, c: Card, ctx: BodyContext) {
  const url = c.url ?? '', thumb = url ? thumbOf(url) : null;
  const domain = h('span', { class: 'ldom', text: domainOf(url) || 'adres yok' });
  const urlIn = h('input', {
    class: `lurl ${CTL}`, value: url, placeholder: 'https://…', spellcheck: false,
    on: {
      input: () => { domain.textContent = domainOf(normalizeUrl(urlIn.value) ?? '') || 'adres yok'; },
      // Adres onaylanınca (Enter / odaktan çıkınca) düzeltilip kaydedilir; küçük resim değişebileceği için kart yeniden kurulur.
      change: () => {
        const next = urlIn.value.trim() ? normalizeUrl(urlIn.value) : '';
        if (next === null) { urlIn.classList.add('bad'); return; }
        urlIn.classList.remove('bad');
        if (next === (c.url ?? '')) return;
        c.url = next || undefined; if (!c.text && next) c.text = domainOf(next);
        ctx.commit(); ctx.rerender(c);
      },
    },
  });
  body.classList.add('rich', 'linkb');
  // Küçük resim internetten gelir; yüklenemezse (çevrimdışı) yerine sade bir yer tutucu kalır, kartın düzeni bozulmaz.
  if (thumb) body.append(h('div', { class: 'lthumb' },
    h('img', { src: thumb, alt: '', referrerPolicy: 'no-referrer', draggable: false, on: { error: e => { const box = (e.target as HTMLElement).parentElement!; box.classList.add('off'); box.replaceChildren(h('span', { text: 'Önizleme yüklenemedi' })); } } })));
  body.append(
    h('input', { class: `rtitle ${CTL}`, value: c.text ?? '', placeholder: 'Başlık', on: { input: e => { c.text = (e.target as HTMLInputElement).value; ctx.commit(); } } }),
    urlIn,
    h('input', { class: `ldesc ${CTL}`, value: c.desc ?? '', placeholder: 'Kısa not…', on: { input: e => { c.desc = (e.target as HTMLInputElement).value || undefined; ctx.commit(); } } }),
    h('div', { class: 'lfoot' }, domain,
      h('button', { class: `lopen ${CTL}`, text: 'Aç ↗', title: 'Yeni sekmede aç', disabled: !url, on: { click: () => open(c.url) } })),
  );
  if (thumb) requestAnimationFrame(() => ctx.grow(c));
}

export const LINK: CardTypeDef = {
  label: 'Bağlantı', size: LINK_SIZE, color: COLORS[3], text: false,
  renderBody,
  editOnClick: () => false,
};
