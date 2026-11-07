import { RenderPlayground } from '../components/RenderPlayground';

export function MediaPage({ notify }: { notify: (m: string, k?: 'error' | 'ok') => void }): JSX.Element {
  return (
    <div className="section-stack">
      <div>
        <span className="eyebrow">MEDIA PIPELINE</span>
        <h2 className="page__title">Render at the edge</h2>
        <p className="page__subtitle">
          Cloudinary-style dynamic transformation over any stored original: width, height, format
          re-encoding (PNG → WebP/AVIF), quality and crop-fit — every unique rendition cached
          immutably and every fresh render dispatched as a signed webhook.
        </p>
      </div>
      <RenderPlayground notify={notify} />
      <div className="card">
        <h3 className="card__title">Render URL grammar</h3>
        <p className="card__hint">
          Drop this behind any CDN edge for planet-scale immutable asset delivery.
        </p>
        <div className="codeblock">
{`GET /v1/storage/render?path=<object-key>&w=<1-4096>&h=<1-4096>&fmt=<webp|avif|jpeg|png>&q=<1-100>&fit=<cover|contain|fill|inside|outside>

→ 200 image/*, Cache-Control: public, max-age=31536000, immutable
→ X-Vortex-Cache: MISS (rendered now) | HIT (served from rendition cache)`}
        </div>
      </div>
    </div>
  );
}
