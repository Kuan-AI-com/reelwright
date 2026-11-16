# TODO

## Before the first public release
- [ ] Add `&REFERRALCODE=<code>` to the Hostinger button URL in the README once the partner account is approved.
- [ ] Make the GHCR package `reelwright` public (org → Packages → reelwright → settings) after the first image build.
- [ ] Build and smoke-test the Docker image on amd64 and arm64 (the CI workflow does this on push).
- [ ] Measure render speed on a 2 vCPU / 8 GB VPS and put the real number in `docs/deploy-hostinger.md`.
- [ ] Test the `signal` theme and background music end to end.

## Next
- [ ] Bundle the theme fonts as files (no Google Fonts fetch at render time).
- [ ] More scene types: line chart, map, image + caption, timeline.
- [ ] Optional upload to YouTube (OAuth) with the synthetic-content flag set.
- [ ] Batch mode: a CSV of topics → a queue of drafts.
- [ ] More voice languages as Kokoro adds them.
