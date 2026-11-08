import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64, formatJSON } from './tools';
describe('local quick tools', () => {
  it('formats JSON and preserves data', () => {
    const input = '{"hello":[1,true,null]}';
    expect(formatJSON(input)).toContain('\n');
    expect(JSON.parse(formatJSON(input))).toEqual(JSON.parse(input));
  });
  it('rejects invalid JSON', () => { expect(() => formatJSON('{oops}')).toThrow(); });
  it('round trips multilingual text and emoji', () => {
    for (const input of ['', 'N.O Group', 'Hello 🌍 — Àbújá — こんにちは']) expect(decodeBase64(encodeBase64(input))).toBe(input);
  });
  it('encodes standard Base64', () => { expect(encodeBase64('hello')).toBe('aGVsbG8='); });
  it('rejects invalid Base64 and invalid UTF-8', () => {
    expect(() => decodeBase64('%%%')).toThrow(); expect(() => decodeBase64('/w==')).toThrow();
  });
});
