import type { Palettes, View } from './types';

export const CFG = Object.freeze({
  STORAGE_KEY: 'gdd-board', GRID: 24, GAP: 0, MIN_W: 120, MIN_H: 72, GROUP_MIN_HEAD: 48, GROUP_MIN_BODY: 72, DRAG_PX: 5,
  SAVE_DELAY: 250, IMG_MAX: 900, FLASH_MS: 4000,
  ZOOM: Object.freeze({ min: .2, max: 6, exitBelow: .27, enterRatio: .55 }),
  HOME_VIEW: Object.freeze({ x: 60, y: 60, z: 1 }) as Readonly<View>,
});

export const COLORS = ['#8e95a3', '#e8a23a', '#3fb97a', '#4a90e2', '#e0556b', '#a367d8'] as const;
export const ARROW_COLOR = '#8e95a3';

export const defaultPalettes = (): Palettes => ({
  color: [...COLORS],
  tc: ['#ffffff', '#111111', ...COLORS.slice(1)],
  fs: [11, 12, 14, 16, 18, 20, 24, 32, 40],
  ac: ['#8e95a3', '#ffffff', '#111111', ...COLORS.slice(1)],
  bg: [...COLORS],
});
