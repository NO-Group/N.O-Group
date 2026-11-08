import { pixelSVG } from './pixel-svg';
self.onmessage = (event: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>) => {
  try { self.postMessage({ svg: pixelSVG(event.data.data, event.data.width, event.data.height) }); }
  catch (e) { self.postMessage({ error: e instanceof Error ? e.message : 'Conversion failed' }); }
};
