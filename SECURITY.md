# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's **private vulnerability reporting** ("Security" tab → "Report a vulnerability") on this repository. We aim to acknowledge within 7 days.

## Scope and design notes

Reelwright is a single-user, self-hosted studio. The security model:

- One password (`REELWRIGHT_PASSWORD`) protects the studio; sessions are HMAC-signed, HttpOnly, `SameSite=Strict` cookies (Secure behind HTTPS). Login attempts are rate-limited per IP.
- If no password is set, a random one is generated and stored in the data directory with `0600` permissions.
- The API accepts only JSON bodies up to 1 MB; file downloads are restricted to known output names per video id.
- Storyboard text is HTML-escaped before it reaches the composition. Live previews are served with a strict CSP (no network, no external resources) inside a sandboxed iframe.
- The container runs as the unprivileged `node` user.

Out of scope: attacks that require the studio password, denial of service by an authenticated user (renders are expensive by design), and the security of the LLM provider you choose.

**Run it behind HTTPS** (`docker-compose.https.yml`) if it is reachable from the internet.
