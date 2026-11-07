import { MultiCloudSelector } from '../components/MultiCloudSelector';
import { MultipartDemo } from '../components/MultipartDemo';
import { ObjectsBrowser } from '../components/ObjectsBrowser';
import { PresignedTester } from '../components/PresignedTester';
import type { ProviderDescriptor } from '../lib/types';

interface StoragePageProps {
  providers: ProviderDescriptor[];
  onProvidersChanged: (providers: ProviderDescriptor[]) => void;
  notify: (message: string, kind?: 'error' | 'ok') => void;
}

export function StoragePage({ providers, onProvidersChanged, notify }: StoragePageProps): JSX.Element {
  return (
    <div className="section-stack">
      <div>
        <span className="eyebrow">MULTI-CLOUD CONTROL PLANE</span>
        <h2 className="page__title">Choose your engine</h2>
        <p className="page__subtitle">
          Six storage targets behind one driver contract. Click any configured card to hot-swap the
          runtime engine — the active target carries the N.O Group spectrum ring.
        </p>
        <MultiCloudSelector
          providers={providers}
          onSwitch={onProvidersChanged}
          onError={(m) => notify(m, 'error')}
        />
      </div>

      <ObjectsBrowser notify={notify} key={providers.find((p) => p.active)?.id ?? 'none'} />

      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <PresignedTester notify={notify} />
        <MultipartDemo notify={notify} />
      </div>
    </div>
  );
}
