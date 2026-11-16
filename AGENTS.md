# Reelwright — notes for coding agents

Self-hosted AI video studio: storyboard JSON → local TTS (Kokoro via HyperFrames) → HTML composition → HyperFrames render → MP4 + SRT. Node 22+, ESM, no build step, no frameworks.

- Tests: `npm run check` (syntax + `node --test`). They never render or hit the network; keep it that way.
- End-to-end: `node src/cli.mjs make --storyboard examples/how-tides-work.json --quality draft`.
- HyperFrames is always run as a child process through `src/hf.mjs`, with telemetry and update checks disabled. Do not import it as a library.
- Compositions must stay deterministic and self-contained (no network, no timers, no randomness). No GSAP: the runtime in `src/compose/runtime.js` animates by seeking time.
- Schema changes: update `src/storyboard.mjs`, `docs/storyboard.md`, `skills/reelwright/references/storyboard.md` and the tests together.
- New dependency or bundled component → add it to `THIRD_PARTY_NOTICES.md` with its license.
- Never commit `.env`, `data/`, rendered media (except `docs/media/`), or secrets.
- The roadmap lives in GitHub issues. `TODO.md` is a local, git-ignored file for maintainer notes.
