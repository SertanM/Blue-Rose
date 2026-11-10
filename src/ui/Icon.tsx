import { ICON, type IconName } from './icons';

/** Sabit simge (ICON tablosundan) ya da verilen yol verisi. */
export function Icon({ name, d }: { name?: IconName; d?: string | string[] }) {
  if (name) return <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICON[name] }} />;
  return <svg viewBox="0 0 24 24">{[d ?? []].flat().map((p, i) => <path key={i} d={p} />)}</svg>;
}
