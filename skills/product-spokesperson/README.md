# Product Spokesperson Adapter (draft)

Source: `hiapi-product-spokesperson-video-skill`.

Owns the four scenarios: synthetic spokesperson, authorized talking head,
product intro, and brand promo. It must preserve the real-person consent gate,
dialogue handling, model route selection, and speech/lip-sync/claim QC.

The adapter must call the shared runner for pricing, spend approval,
idempotency, retries, polling, output download, and manifest/QC artifacts.
