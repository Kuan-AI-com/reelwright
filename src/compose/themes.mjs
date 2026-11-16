// Visual themes. Only fonts bundled with HyperFrames (and their bundled weights)
// are used, so renders work offline and look the same on every machine.

export const THEME_TOKENS = {
  midnight: {
    label: 'Midnight — deep navy, electric cyan',
    bg: '#0a0e1a',
    surface: 'rgba(255,255,255,0.06)',
    fg: '#f4f7ff',
    muted: '#9aa6c4',
    accent: '#46e0ff',
    accent2: '#8b7bff',
    glowA: 'rgba(70,224,255,0.22)',
    glowB: 'rgba(139,123,255,0.20)',
    head: "'Inter', sans-serif",
    headWeight: 900,
    body: "'Inter', sans-serif",
    tracking: '-0.035em',
    captionBg: 'rgba(5,8,16,0.72)',
  },
  paper: {
    label: 'Paper — warm editorial, ink and red',
    bg: '#f3eee4',
    surface: 'rgba(30,24,16,0.06)',
    fg: '#1d1a16',
    muted: '#6b6257',
    accent: '#d4442a',
    accent2: '#2a5bd4',
    glowA: 'rgba(212,68,42,0.10)',
    glowB: 'rgba(42,91,212,0.08)',
    head: "'Playfair Display', serif",
    headWeight: 700,
    body: "'Inter', sans-serif",
    tracking: '-0.02em',
    captionBg: 'rgba(29,26,22,0.86)',
  },
  signal: {
    label: 'Signal — loud black and yellow',
    bg: '#0d0d0d',
    surface: 'rgba(255,230,0,0.08)',
    fg: '#ffffff',
    muted: '#b3b3b3',
    accent: '#ffe600',
    accent2: '#ff4d6d',
    glowA: 'rgba(255,230,0,0.14)',
    glowB: 'rgba(255,77,109,0.12)',
    head: "'Archivo Black', sans-serif",
    headWeight: 400,
    body: "'Inter', sans-serif",
    tracking: '-0.01em',
    captionBg: 'rgba(0,0,0,0.8)',
  },
};

export function themeCss(name, { width, height }) {
  const t = THEME_TOKENS[name] || THEME_TOKENS.midnight;
  const portrait = height > width;
  const square = height === width;
  // Type scale per orientation (px at 1080 on the short side).
  const s = portrait ? { h1: 104, h2: 76, body: 44, big: 220, cap: 54 } : square ? { h1: 96, h2: 68, body: 40, big: 200, cap: 46 } : { h1: 112, h2: 78, body: 42, big: 240, cap: 50 };
  const padX = Math.round(width * (portrait ? 0.08 : 0.09));
  const padY = Math.round(height * (portrait ? 0.12 : 0.11));
  const capBottom = Math.round(height * (portrait ? 0.2 : 0.085));
  return `
:root {
  --bg: ${t.bg}; --surface: ${t.surface}; --fg: ${t.fg}; --muted: ${t.muted};
  --accent: ${t.accent}; --accent2: ${t.accent2};
  --head: ${t.head}; --head-weight: ${t.headWeight}; --body: ${t.body}; --tracking: ${t.tracking};
  --h1: ${s.h1}px; --h2: ${s.h2}px; --text: ${s.body}px; --big: ${s.big}px; --cap: ${s.cap}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: var(--bg); }
body { color: var(--fg); font-family: var(--body); -webkit-font-smoothing: antialiased; }
#bg { position: absolute; inset: 0; background: var(--bg); overflow: hidden; }
#bg .orbs { position: absolute; inset: -10%;
  background: radial-gradient(40% 50% at 18% 22%, ${t.glowA}, transparent 70%),
              radial-gradient(45% 55% at 85% 80%, ${t.glowB}, transparent 70%); }
#bg .grain { position: absolute; inset: 0; opacity: ${name === 'paper' ? 0.5 : 0.35};
  background-image: linear-gradient(${name === 'signal' ? 'rgba(255,255,255,0.035)' : 'transparent'} 1px, transparent 1px),
                    linear-gradient(90deg, ${name === 'signal' ? 'rgba(255,255,255,0.035)' : 'transparent'} 1px, transparent 1px);
  background-size: 80px 80px; }
.scene { position: absolute; inset: 0; }
.scene > .inner { position: absolute; inset: 0; padding: ${padY}px ${padX}px; display: flex; flex-direction: column; justify-content: center; gap: 36px; }
.scene.center > .inner { align-items: center; text-align: center; }
.kicker { width: 120px; height: 10px; border-radius: 5px; background: var(--accent); transform-origin: left center; }
.center .kicker { transform-origin: center; }
h1, h2 { font-family: var(--head); font-weight: var(--head-weight); letter-spacing: var(--tracking); line-height: 1.02; text-wrap: balance; }
h1 { font-size: var(--h1); }
h2 { font-size: var(--h2); }
.sub { font-size: calc(var(--text) * 1.1); color: var(--muted); line-height: 1.3; max-width: 30ch; text-wrap: balance; font-weight: 400; }
.accent { color: var(--accent); }
ul.points { list-style: none; display: flex; flex-direction: column; gap: 26px; margin-top: 12px; }
ul.points li { font-size: var(--text); line-height: 1.25; display: flex; gap: 26px; align-items: baseline; font-weight: 700; }
ul.points li .dot { flex: none; width: 0.55em; height: 0.55em; border-radius: 50%; background: var(--accent); transform: translateY(-0.08em); }
.big { font-family: var(--head); font-weight: var(--head-weight); font-size: var(--big); line-height: 0.95; letter-spacing: var(--tracking); color: var(--accent); font-variant-numeric: tabular-nums; }
.label { font-size: calc(var(--text) * 1.2); font-weight: 700; max-width: 26ch; line-height: 1.2; text-wrap: balance; }
.source { font-size: calc(var(--text) * 0.6); color: var(--muted); letter-spacing: 0.02em; }
.bars { display: flex; flex-direction: column; gap: ${portrait ? 34 : 26}px; margin-top: 8px; }
.bar-row { display: grid; grid-template-columns: ${portrait ? '1fr' : '28% 1fr'}; gap: ${portrait ? 10 : 28}px; align-items: center; }
.bar-label { font-size: var(--text); font-weight: 700; }
.bar-line { display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: center; }
.bar-track { position: relative; height: ${portrait ? 54 : 58}px; border-radius: 12px; background: var(--surface); overflow: hidden; }
.bar-fill { position: absolute; inset: 0; background: linear-gradient(90deg, var(--accent), var(--accent2)); transform-origin: left center; border-radius: 12px; }
.bar-value { min-width: 4.2ch; text-align: right; font-weight: 900; font-size: calc(var(--text) * 0.9); font-variant-numeric: tabular-nums; color: var(--fg); }
.quote-mark { font-family: var(--head); font-size: calc(var(--big) * 1.1); line-height: 0.6; color: var(--accent); height: 0.45em; }
blockquote { font-family: var(--head); font-weight: var(--head-weight); font-size: var(--h2); line-height: 1.12; letter-spacing: var(--tracking); text-wrap: balance; max-width: 22ch; }
.author { font-size: var(--text); color: var(--fg); opacity: 0.72; font-weight: 700; }
.compare { display: grid; grid-template-columns: ${portrait ? '1fr' : '1fr auto 1fr'}; gap: ${portrait ? 28 : 40}px; align-items: stretch; }
.card { background: var(--surface); border-radius: 28px; padding: ${portrait ? 44 : 52}px; display: flex; flex-direction: column; gap: 20px; border: 2px solid transparent; }
.card.right { border-color: var(--accent); }
.card h3 { font-family: var(--head); font-weight: var(--head-weight); font-size: calc(var(--h2) * 0.8); letter-spacing: var(--tracking); line-height: 1.05; }
.card p { font-size: var(--text); color: var(--muted); line-height: 1.3; }
.vs { align-self: center; font-weight: 900; font-size: var(--text); color: var(--accent); letter-spacing: 0.08em; }
#captions { position: absolute; left: 0; right: 0; bottom: ${capBottom}px; display: flex; justify-content: center; pointer-events: none; }
.cap { position: absolute; bottom: 0; max-width: ${Math.round(width * 0.84)}px; text-align: center; padding: 14px 28px; border-radius: 18px; background: ${t.captionBg}; font-family: 'Inter', sans-serif; font-weight: 900; font-size: var(--cap); line-height: 1.18; letter-spacing: -0.01em; }
.cap .w { display: inline-block; color: rgba(255,255,255,0.62); margin: 0 0.14em; }
.cap .w.active { color: ${name === 'paper' ? '#ffd166' : t.accent}; transform: scale(1.06); }
.cap .w.spoken { color: #ffffff; }
#badge { position: absolute; top: ${Math.round(height * 0.035)}px; right: ${Math.round(width * 0.03)}px; font: 700 ${portrait ? 30 : 28}px 'Inter', sans-serif; color: var(--muted); background: var(--surface); padding: 8px 16px; border-radius: 999px; letter-spacing: 0.04em; }
#progress-track { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: transparent; }
#progress { position: absolute; inset: 0; background: var(--accent); transform-origin: left center; opacity: 0.85; }
`;
}
