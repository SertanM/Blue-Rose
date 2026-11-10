import { CFG } from '../core/config';
import { events, type AskOptions } from './context';

let flashTimer: ReturnType<typeof setTimeout> | undefined;

/** Durum çubuğunda kısa bir mesaj gösterir. */
export function flash(text: string) {
  events.emit('status', text);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => events.emit('status', ''), CFG.FLASH_MS);
}

/** Uygulama içi onay/giriş penceresi (tarayıcı pencereleri engellenebildiği için). Girişte metin ya da null, onayda true/false döner. */
export function ask(msg: string, opts: AskOptions & { input: string }): Promise<string | null>;
export function ask(msg: string, opts?: AskOptions): Promise<boolean>;
export function ask(msg: string, opts: AskOptions = {}): Promise<string | boolean | null> {
  return new Promise(resolve => events.emit('ask', { msg, opts, resolve }));
}
