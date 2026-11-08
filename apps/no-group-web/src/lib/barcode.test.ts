import { barcodeDimensions } from './barcode-svg';
import { expect, it } from 'vitest';
import { toSVG } from 'bwip-js/browser';
it('creates standalone QR SVG for links and Unicode', () => {
  for (const text of ['https://no-group.org','Hello 🌍 Àbújá']) {
    const svg = toSVG({ bcid: 'qrcode', text, scale: 3, padding: 12, backgroundcolor: 'FFFFFF' });
    expect(svg).toContain('<svg'); expect(svg).toContain('<path'); expect(svg).toContain('viewBox');
  }
});
it('creates a printable Code 128 SVG', () => {
  expect(toSVG({ bcid: 'code128', text: 'NO-GROUP-123', scale: 3, height: 15, padding: 12 })).toContain('<svg');
});

it('preserves explicit native module dimensions for scanners',()=>{expect(barcodeDimensions('<svg viewBox="0 0 573 201" xmlns="http://www.w3.org/2000/svg">')).toContain('width="573" height="201"');});
