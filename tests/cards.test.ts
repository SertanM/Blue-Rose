import { describe, expect, it } from 'vitest';
import { domainOf, normalizeUrl, thumbOf } from '../src/cards/link';
import { addCol, addRow, MAX_COLS, normalizeRows, removeCol, removeRow } from '../src/cards/table';
import { nextState, progress, stateOf } from '../src/cards/todo';

describe('bağlantı', () => {
  it('adresi düzeltir, yalnızca http(s) kabul eder', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a');
    expect(normalizeUrl('  http://x.io ')).toBe('http://x.io/');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,hi')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });
  it('alan adı', () => {
    expect(domainOf('https://www.artstation.com/x')).toBe('artstation.com');
    expect(domainOf('bozuk')).toBe('');
  });
  it('YouTube ve görsel bağlantılarında küçük resim verir', () => {
    expect(thumbOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(thumbOf('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(thumbOf('https://youtube.com/shorts/abcdefGHIJ1')).toBe('https://img.youtube.com/vi/abcdefGHIJ1/hqdefault.jpg');
    expect(thumbOf('https://cdn.site.com/art/ref.PNG')).toBe('https://cdn.site.com/art/ref.PNG');
    expect(thumbOf('https://example.com/page')).toBeNull();
  });
});

describe('tablo', () => {
  it('eksik hücreleri tamamlar ve varsayılan tablo verir', () => {
    expect(normalizeRows([['a', 'b'], ['c']])).toEqual([['a', 'b'], ['c', '']]);
    expect(normalizeRows(undefined)).toHaveLength(3);
  });
  it('satır / sütun ekler ve siler; başlık satırı ve son sütun korunur', () => {
    const r = normalizeRows([['A', 'B'], ['1', '2']]);
    addRow(r); expect(r).toEqual([['A', 'B'], ['1', '2'], ['', '']]);
    addCol(r); expect(r[0]).toEqual(['A', 'B', '']); expect(r[1]).toEqual(['1', '2', '']);
    removeRow(r, 0); expect(r).toHaveLength(3);
    removeRow(r, 2); expect(r).toHaveLength(2);
    removeCol(r, 0); removeCol(r, 0); removeCol(r, 0);
    expect(r[0]).toEqual(['']);
  });
  it(`en fazla ${MAX_COLS} sütun`, () => {
    const r = normalizeRows([Array(MAX_COLS).fill('x')]);
    addCol(r); expect(r[0]).toHaveLength(MAX_COLS);
  });
});

describe('yapılacaklar', () => {
  it('durum döngüsü: yapılacak → sürüyor → bitti → yapılacak; eski kayıtlar okunur', () => {
    expect(nextState('todo')).toBe('doing');
    expect(nextState('doing')).toBe('done');
    expect(nextState('done')).toBe('todo');
    expect(stateOf({ id: 'a', text: '', done: true })).toBe('done');
    expect(stateOf({ id: 'a', text: '', done: false })).toBe('todo');
  });
  it('ilerleme: biten tam, süren yarım birim', () => {
    const p = progress([{ id: '1', text: '', state: 'done' }, { id: '2', text: '', state: 'done' }, { id: '3', text: '', state: 'doing' }, { id: '4', text: '', state: 'todo' }]);
    expect(p).toMatchObject({ n: 4, done: 2, doing: 1, green: .5, yellow: .125 });
    expect(progress([])).toMatchObject({ green: 0, yellow: 0 });
  });
});
