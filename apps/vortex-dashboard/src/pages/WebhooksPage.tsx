import { WebhookFeed } from '../components/WebhookFeed';

export function WebhooksPage(): JSX.Element {
  return (
    <div className="section-stack">
      <div>
        <span className="eyebrow">EVENT-DRIVEN WEBHOOKS</span>
        <h2 className="page__title">Signed engine events</h2>
        <p className="page__subtitle">
          Every mutation dispatches an HMAC-SHA256-signed webhook. Retries follow exponential
          backoff; terminal failures dead-letter to disk for replay.
        </p>
      </div>
      <WebhookFeed />
    </div>
  );
}
