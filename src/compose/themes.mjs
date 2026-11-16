// Visual themes. Only fonts that HyperFrames bundles or fetches by name are used,
// so renders look the same on every machine.
//
// Design rules (they are what keeps the output from looking like a template):
// flat backgrounds, no glow blobs or gradients; text set flush left on a grid;
// one accent colour, used for one thing per scene; labels in a monospace;
// hairline rules instead of cards and pills.

export const THEME_TOKENS = {
  midnight: {
    label: 'Midnight — ink black, warm white, one vermilion accent',
    bg: '#111214',
    fg: '#f1ede4',
    muted: '#8f8b83',
    line: 'rgba(241,237,228,0.16)',
    accent: '#ff5b2e',
    barRest: 'rgba(241,237,228,0.28)',
    head: "'Inter', sans-serif",
    headWeight: 700,
    headCase: 'none',
    headScale: 1,
    tracking: '-0.045em',
    body: "'Inter', sans-serif",
    mono: "'IBM Plex Mono', monospace",
    captionBg: 'rgba(17,18,20,0.88)',
    captionFg: '#f1ede4',
    captionActive: '#ff5b2e',
  },
  paper: {
    label: 'Paper — cream page, serif headlines, red ink',
    bg: '#f2ede3',
    fg: '#1b1915',
    muted: '#6d665c',
    line: 'rgba(27,25,21,0.2)',
    accent: '#c8361d',
    barRest: 'rgba(27,25,21,0.22)',
    head: "'EB Garamond', serif",
    headWeight: 500,
    headCase: 'none',
    headScale: 1.12,
    tracking: '-0.02em',
    body: "'Inter', sans-serif",
    mono: "'IBM Plex Mono', monospace",
    captionBg: 'rgba(27,25,21,0.9)',
    captionFg: '#f2ede3',
    captionActive: '#ff8a6b',
  },
  signal: {
    label: 'Signal — black and yellow, condensed poster type',
    bg: '#0b0b0b',
    fg: '#ffffff',
    muted: '#9a9a9a',
    line: 'rgba(255,255,255,0.18)',
    accent: '#ffe14d',
    barRest: 'rgba(255,255,255,0.3)',
    head: "'League Gothic', 'Oswald', 'Arial Narrow', sans-serif",
    headWeight: 400,
    headCase: 'uppercase',
    headScale: 1.45,
    tracking: '0.005em',
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
    captionBg: '#ffe14d',
    captionFg: '#0b0b0b',
    captionActive: '#0b0b0b',
  },
};

export function themeCss(name, { width, height }) {
  const t = THEME_TOKENS[name] || THEME_TOKENS.midnight;
  const portrait = height > width;
  const square = height === width;
  const k = t.headScale;
  // Type scale per orientation (px at 1080 on the short side).
  const s = portrait ? { h1: 120, h2: 80, body: 44, big: 300, cap: 52, mono: 26 } : square ? { h1: 108, h2: 72, body: 40, big: 260, cap: 46, mono: 24 } : { h1: 132, h2: 84, body: 40, big: 300, cap: 48, mono: 24 };
  const padX = Math.round(width * (portrait ? 0.08 : 0.075));
  const headY = Math.round(height * (portrait ? 0.05 : 0.06));
  const padTop = Math.round(height * (portrait ? 0.16 : 0.17));
  const padBottom = Math.round(height * (portrait ? 0.3 : 0.24));
  const capBottom = Math.round(height * (portrait ? 0.17 : 0.075));
  const signal = name === 'signal';
  return `
:root {
  --bg: ${t.bg}; --fg: ${t.fg}; --muted: ${t.muted}; --line: ${t.line};
  --accent: ${t.accent}; --bar-rest: ${t.barRest};
  --head: ${t.head}; --head-weight: ${t.headWeight}; --head-case: ${t.headCase}; --tracking: ${t.tracking};
  --body: ${t.body}; --mono: ${t.mono};
  --h1: ${Math.round(s.h1 * k)}px; --h2: ${Math.round(s.h2 * k)}px; --text: ${s.body}px; --big: ${Math.round(s.big * (signal ? 1.25 : 1))}px; --cap: ${s.cap}px; --mono-size: ${s.mono}px;
  --pad-x: ${padX}px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: var(--bg); }
body { color: var(--fg); font-family: var(--body); -webkit-font-smoothing: antialiased; }
#bg { position: absolute; inset: 0; background: var(--bg); }

/* Running header: video title on the left, disclosure on the right, a hairline under both. */
#masthead { position: absolute; left: var(--pad-x); right: var(--pad-x); top: ${headY}px; padding-bottom: 18px; border-bottom: 2px solid var(--line);
  font: 500 var(--mono-size)/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
#masthead .t { max-width: ${portrait ? '58%' : '70%'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
#badge { position: absolute; right: var(--pad-x); top: ${headY}px; font: 500 var(--mono-size)/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.num { position: absolute; left: var(--pad-x); top: ${headY + Math.round(s.mono * 1.9)}px; font: 500 var(--mono-size)/1 var(--mono); letter-spacing: 0.08em; color: var(--accent); }

.scene { position: absolute; inset: 0; }
.scene > .inner { position: absolute; inset: 0; padding: ${padTop}px var(--pad-x) ${padBottom}px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: ${portrait ? 40 : 34}px; }
h1, h2, h3, blockquote { font-family: var(--head); font-weight: var(--head-weight); letter-spacing: var(--tracking); text-transform: var(--head-case); text-wrap: balance; }
h1 { font-size: var(--h1); line-height: ${signal ? 0.92 : 0.98}; max-width: ${portrait ? '100%' : '15ch'}; }
h2 { font-size: var(--h2); line-height: 1; max-width: ${portrait ? '100%' : '22ch'}; }
.sub { font-size: calc(var(--text) * 1.05); color: var(--muted); line-height: 1.35; max-width: 34ch; text-wrap: pretty; }
.rule { width: 100%; height: 2px; background: var(--line); transform-origin: left center; }
.tag { font: 500 var(--mono-size)/1.3 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }

ol.points { list-style: none; width: 100%; display: flex; flex-direction: column; margin-top: 6px; border-top: 2px solid var(--line); }
ol.points li { display: grid; grid-template-columns: ${portrait ? '2.4em' : '3em'} 1fr; align-items: baseline; padding: ${portrait ? 26 : 22}px 0; border-bottom: 2px solid var(--line); font-size: var(--text); line-height: 1.25; font-weight: 500; }
ol.points li .n { font: 500 var(--mono-size)/1 var(--mono); color: var(--accent); letter-spacing: 0.06em; }

.big { font-family: var(--head); font-weight: ${signal ? 400 : name === 'paper' ? 500 : 700}; font-size: var(--big); line-height: 0.86; letter-spacing: ${signal ? '0' : '-0.055em'}; color: var(--accent); font-variant-numeric: tabular-nums; margin-left: -0.04em; }
.label { font-size: calc(var(--text) * 1.25); font-weight: 600; max-width: 22ch; line-height: 1.2; text-wrap: balance; }
.source { font: 500 var(--mono-size)/1.3 var(--mono); color: var(--muted); letter-spacing: 0.04em; }
.source::before { content: 'Source  '; text-transform: uppercase; letter-spacing: 0.08em; }
html[lang^="es"] .source::before { content: 'Fuente  '; }
html[lang^="fr"] .source::before { content: 'Source  '; }

.bars { width: 100%; display: flex; flex-direction: column; gap: ${portrait ? 30 : 22}px; }
.bar-row { display: grid; grid-template-columns: ${portrait ? '1fr' : '30% 1fr'}; gap: ${portrait ? 12 : 32}px; align-items: center; }
.bar-label { font-size: var(--text); font-weight: 500; line-height: 1.15; }
.bar-line { display: grid; grid-template-columns: 1fr 5.4em; gap: 24px; align-items: center; }
.bar-track { position: relative; height: ${portrait ? 40 : 38}px; border-left: 2px solid var(--fg); }
.bar-fill { position: absolute; inset: 0; background: var(--bar-rest); transform-origin: left center; }
.bar-row.top .bar-fill { background: var(--accent); }
.bar-value { text-align: right; white-space: nowrap; font: 500 calc(var(--text) * 0.85)/1 var(--mono); font-variant-numeric: tabular-nums; color: var(--fg); }

blockquote { font-size: calc(var(--h2) * ${signal ? 1 : 0.95}); line-height: 1.08; max-width: 20ch; text-indent: -0.42em; }
blockquote .q { color: var(--accent); }
.author { font: 500 var(--mono-size)/1.3 var(--mono); color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }

.compare { width: 100%; display: grid; grid-template-columns: ${portrait ? '1fr' : '1fr 1fr'}; border-top: 2px solid var(--line); }
.side { padding: ${portrait ? '30px 0' : '34px 48px 0 0'}; display: flex; flex-direction: column; gap: 18px; }
.side.right { ${portrait ? 'border-top: 2px solid var(--line);' : 'border-left: 2px solid var(--line); padding-left: 48px;'} }
.side h3 { font-size: calc(var(--h2) * 0.78); line-height: 1; }
.side.right h3 { color: var(--accent); }
.side p { font-size: var(--text); color: var(--muted); line-height: 1.32; max-width: 24ch; }

#captions { position: absolute; left: var(--pad-x); right: var(--pad-x); bottom: ${capBottom}px; pointer-events: none; }
.cap { position: absolute; left: -24px; bottom: 0; max-width: calc(100% + 48px); text-align: left; padding: 12px 24px; border-radius: 4px; background: ${t.captionBg}; font-family: 'Inter', sans-serif; font-weight: 700; font-size: var(--cap); line-height: 1.2; letter-spacing: -0.015em; }
.cap .w { display: inline-block; color: ${t.captionFg}; opacity: 0.55; margin-right: 0.24em; }
.cap .w:last-child { margin-right: 0; }
.cap .w.spoken { opacity: 1; }
.cap .w.active { opacity: 1; color: ${t.captionActive}; ${signal ? 'text-decoration: underline; text-decoration-thickness: 0.09em; text-underline-offset: 0.12em;' : ''} }
#progress-track { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; }
#progress { position: absolute; inset: 0; background: var(--accent); transform-origin: left center; }
`;
}
