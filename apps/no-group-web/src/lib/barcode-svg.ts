/** Keep exact module dimensions instead of SVG's default 300px intrinsic width. */
export function barcodeDimensions(svg: string) {
  return svg.replace(/<svg viewBox="0 0 (\d+) (\d+)"/, '<svg width="$1" height="$2" viewBox="0 0 $1 $2"');
}
