export function pixelSVG(data: Uint8ClampedArray, width: number, height: number): string {
  if (width < 1 || height < 1 || width * height > 2_000_000 || data.length !== width * height * 4) throw Error('Image must contain at most 2 million pixels.');
  const paths: string[] = []; let outputBytes = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width;) {
    const i = (y * width + x) * 4; const r = data[i]!, g = data[i+1]!, b = data[i+2]!, a = data[i+3]!;
    let end = x + 1;
    while (end < width) { const j = (y * width + end) * 4; if (data[j] !== r || data[j+1] !== g || data[j+2] !== b || data[j+3] !== a) break; end++; }
    if (a) paths.push(`<path fill="#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}"${a < 255 ? ` fill-opacity="${a/255}"` : ''} d="M${x} ${y}h${end-x}v1H${x}z"/>`);
    if (a) { outputBytes += paths[paths.length-1]!.length; if (outputBytes > 64 * 1024 * 1024) throw Error('Vector output exceeds 64 MB. Use a smaller image or a dedicated contour tracer.'); }
    x = end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${paths.join('')}</svg>`;
}
