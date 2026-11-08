import { expect, it } from 'vitest';
import { pixelSVG } from './pixel-svg';
it('merges equal adjacent colors into vector runs without quantization', () => {
  const svg = pixelSVG(new Uint8ClampedArray([12,34,56,255,12,34,56,255,255,1,2,128]),3,1);
  expect(svg).toContain('#0c2238'); expect(svg).toContain('h2v1'); expect(svg).toContain('#ff0102'); expect(svg).toContain(`fill-opacity="${128/255}"`);
  expect(svg).not.toContain('<image'); expect(svg).not.toContain('data:');
});
it('omits fully transparent pixels and keeps dimensions', () => {
  const svg = pixelSVG(new Uint8ClampedArray([0,0,0,0]),1,1); expect(svg).not.toContain('<path'); expect(svg).toContain('viewBox="0 0 1 1"');
});
it('rejects oversized or inconsistent pixel data', () => {
  expect(() => pixelSVG(new Uint8ClampedArray(4),2,2)).toThrow();
  expect(() => pixelSVG(new Uint8ClampedArray(0),2001,1000)).toThrow();
});
