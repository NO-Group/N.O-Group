import { useState } from 'react';
import { api } from '../lib/api';
import type { ProviderDescriptor } from '../lib/types';
import { GradientBorder } from './GradientBorder';
import { IconCloud, IconDisk } from './icons';

interface MultiCloudSelectorProps {
  providers: ProviderDescriptor[];
  onSwitch: (providers: ProviderDescriptor[]) => void;
  onError: (message: string) => void;
}

/**
 * The Vortex Multi-Cloud Selector — the visual control plane for the
 * storage engine. Six provider cards; the runtime-active engine wears
 * the animated N.O Group spectrum ring. Clicking a configured card
 * hot-swaps the active driver via POST /v1/storage/providers/active.
 */
export function MultiCloudSelector({
  providers,
  onSwitch,
  onError,
}: MultiCloudSelectorProps): JSX.Element {
  const [pending, setPending] = useState<string | null>(null);

  const select = async (provider: ProviderDescriptor): Promise<void> => {
    if (provider.active || pending) return;
    if (!provider.configured) return; // card shows missing env footer instead
    setPending(provider.id);
    try {
      const result = await api.setActiveProvider(provider.id);
      onSwitch(result.providers);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to switch provider');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="provider-grid">
      {providers.map((provider) => (
        <GradientBorder
          key={provider.id}
          active={provider.active}
          className="provider-wrap"
          role="button"
          tabIndex={0}
          onClick={() => void select(provider)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void select(provider);
            }
          }}
        >
          <div className={`provider vtx-stop-${provider.accentStop}`}>
            <div className="provider__head">
              <div className="provider__mark">
                {provider.id === 'local_disk' ? <IconDisk /> : <IconCloud />}
              </div>
              <span className="provider__tier">{provider.tier}</span>
            </div>

            <div>
              <div className="provider__name">{provider.label}</div>
              <div className="provider__tagline">{provider.tagline}</div>
            </div>

            <p className="provider__desc mt-0">{provider.description}</p>

            <div className="provider__endpoint">{provider.endpointHint}</div>

            <div className="provider__foot">
              {provider.configured ? (
                <span className="provider__status provider__status--on">
                  <i /> credentials OK
                </span>
              ) : (
                <span className="provider__status provider__status--off">
                  <i /> not configured
                </span>
              )}
              {provider.active && <span className="provider__active-tag">Active engine</span>}
              {pending === provider.id && (
                <span className="provider__status">
                  <i className="pulse-dot" style={{ background: 'var(--vtx-stop-4)' }} /> switching…
                </span>
              )}
            </div>

            {!provider.configured && provider.missingEnv.length > 0 && (
              <div className="provider__missing">
              <span style={{ width: '100%', marginBottom: 2 }}>missing env →</span>
                {provider.missingEnv.map((name) => (
                  <code key={name}>{name}</code>
                ))}
              </div>
            )}
          </div>
        </GradientBorder>
      ))}
    </div>
  );
}
