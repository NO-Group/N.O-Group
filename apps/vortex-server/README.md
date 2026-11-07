# @vortex/server — Vortex Storage Engine

The multi-cloud object-storage core of the Vortex BaaS platform. One strict driver
contract (`IVortexStorageDriver`), six interchangeable targets, a media pipeline,
signed webhooks and JWT/RLS protection.

## Architecture

```
                    ┌────────────────────────────────────────────┐
                    │              Express HTTP API              │
                    │  /v1/storage/*   /v1/system/*   /health    │
                    └───────────────┬────────────────────────────┘
              ┌───────────────────┼───────────────────────────┐
              ▼                   ▼                           ▼
    VortexStorageGuard     Storage Router              WebhookService
      JWT + RLS rules      (media, multipart,       HMAC-SHA256 signed,
      claim ↔ path binding  presign, bulk, render)  exponential backoff
                          │
                          ▼
                   DriverRegistry (lazy, hot-swappable)
                          │  IVortexStorageDriver
   ┌──────────┬───────────┼───────────┬──────────┬───────────────┐
   ▼          ▼           ▼           ▼          ▼               ▼
Cloudflare   AWS S3   DigitalOcean   GCS      Azure Blob      Local Disk
   R2      (dynamic   Spaces        (S3      (Block Blob +    (./vortex_data/
 (S3 dialect, region) (S3 dialect)  interop,  SAS presigns,    storage/ volume,
 $0 egress)                        HMAC keys) stage/commit)   HMAC transfer URLs)
                          │
                          ▼
                  MultipartJanitor — sweeps orphaned
                  multipart sessions older than 24h
                  (journaled to vortex_data/multipart-registry.json)
```

## The driver contract

`src/core/types/storage.types.ts` defines the full interface — upload, download,
delete, bulk-delete, presign, initiate/upload/complete multipart, list, exists.
BaseS3Driver implements it generically over AWS SDK v3; the R2 / AWS / Spaces /
GCS adapters only configure endpoint, region style and credentials. Azure Blob maps
the contract onto native block blobs (`stageBlock`/`commitBlockList` for multipart).
Local Disk implements the whole contract against the filesystem with an MD5-hashing
write pipeline.

## Configuration

Everything is environment-driven — copy `.env.example` to `.env`. Unconfigured
providers are reported to the dashboard with their missing variable names; nothing
hard-fails at boot.

## Notable behaviors

- **Bulk delete** chunks to 1,000 keys (S3 `DeleteObjects` ceiling) and falls back to
  bounded-parallel single deletes when a batch call fails or a provider lacks it.
- **Render cache** keys renditions by `sha256(provider, key, params)`; fresh renders
  dispatch `transform.rendered`, cache hits stay silent and immutable.
- **Presigned uploads** default to 15 minutes and cap at 1 hour.
- **Local disk presigns** mint HMAC-SHA256 transfer URLs served by
  `/v1/storage/local-transfer` (constant-time verified, streaming bodies).
- sharp is loaded lazily — if native bindings are absent the engine still boots and
  `/render` answers `501 CAPABILITY_UNAVAILABLE`.

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | tsx watch-mode engine on :8787 |
| `npm run start` | tsx engine (no watch) |
| `npm run seed` | demo objects via the HTTP API |
| `npm run typecheck` | strict `tsc` |
| `npm run build` | emit `dist/` (NodeNext) |
