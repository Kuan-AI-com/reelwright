/**
 * Slop check: flags the writing habits that make AI-written videos feel
 * generic — stock openers, hype words, empty endings, "it's not X, it's Y",
 * unsourced numbers, on-screen text that repeats the voice word for word.
 *
 * It is a heuristic, not a judge: every finding says why and what to do.
 * Pure function, no network; used by the CLI (`reelwright lint`), the studio
 * and the LLM drafting loop.
 */

// [pattern, label, suggestion]. Patterns are matched case-insensitively on narration and on-screen text.
const PHRASES = {
  opener: [
    [/\bin today'?s (fast[- ]paced|digital|modern|ever[- ]changing) world\b/, "in today's … world", 'Open with a concrete fact, image or question that only this topic has.'],
    [/\bhave you ever (wondered|asked yourself|thought about)\b/, 'have you ever wondered', 'Ask the actual question, or state the surprising fact directly.'],
    [/\b(let'?s|we'?ll) (dive|dig|jump) (in|into|right in)\b/, "let's dive in", 'Cut it. Start with the first real point.'],
    [/\b(buckle up|without further ado|stay tuned)\b/, 'filler transition', 'Cut it.'],
    [/\bin this video,? (we|i)('ll| will)\b/, 'in this video we will', 'Show, don’t announce: start with the content.'],
    [/\bimagine a world (where|in which)\b/, 'imagine a world', 'Describe one specific situation instead.'],
    [/\ben el mundo (actual|de hoy|moderno|digital)\b/, 'en el mundo actual', 'Empieza con un dato o una imagen concreta del tema.'],
    [/¿?\s*alguna vez te has preguntado\b/, 'alguna vez te has preguntado', 'Haz la pregunta real o da el dato sorprendente.'],
    [/\b(sumérgete|vamos a sumergirnos|sumerjámonos|adentrémonos)\b/, 'sumerjámonos', 'Quítalo. Empieza por el primer punto real.'],
    [/\ben este v[ií]deo (vamos a|veremos|te contamos)\b/, 'en este video vamos a', 'Muestra en vez de anunciar.'],
  ],
  hype: [
    [/\b(game[- ]chang(er|ing)|revolutionar(y|ize)|groundbreaking|cutting[- ]edge|state[- ]of[- ]the[- ]art|next[- ]level|mind[- ]blowing)\b/, 'hype word', 'Replace with the specific thing that changed, and by how much.'],
    [/\b(unlock|unleash|harness|supercharge|elevate|empower|embark)\w*\b/, 'AI-flavoured verb', 'Use a plain verb: get, use, start, raise.'],
    [/\b(delve|tapestry|testament to|realm of|navigate the complexit|ever[- ]evolving landscape|in the landscape of|seamless(ly)?|robust|pivotal|intricate)\b/, 'LLM tell', 'Say it the way a person would out loud.'],
    [/\b(revolucionari[oa]|innovador(a|es)?|de vanguardia|potenciar|desbloquear|sin precedentes|un antes y un después|fascinante mundo)\b/, 'palabra de humo', 'Cámbiala por el dato concreto: qué cambió y cuánto.'],
  ],
  ending: [
    [/\b(the possibilities are endless|only time will tell|the future is (bright|here|now)|the rest is history|and that'?s (just )?the beginning)\b/, 'empty ending', 'End on the one thing the viewer should remember or do.'],
    [/\b(in conclusion|to sum (it )?up|all in all|at the end of the day)\b/, 'essay connector', 'Cut it; just say the takeaway.'],
    [/\b(las posibilidades son infinitas|solo el tiempo lo dir[aá]|el futuro es (brillante|ahora)|en conclusi[oó]n|en resumen|al final del d[ií]a)\b/, 'cierre vacío', 'Termina con lo único que el espectador debe recordar o hacer.'],
    [/\b(like and subscribe|smash (that|the) like|dale like y suscr[ií]bete)\b/, 'generic CTA', 'If you want a call to action, make it specific to this video.'],
  ],
};

const NOT_X_BUT_Y = [
  /\b(it'?s|this is|that'?s|is) not (just |only |merely |simply )?(about )?[^.!?]{1,48}[,;—–-]\s*(it'?s|but|this is)\b/i,
  /\bno (es|se trata de) (solo |sólo |solamente |simplemente )?[^.!?]{1,48}[,;—–-]\s*(es|sino)\b/i,
];

// JS's \b only knows ASCII letters; rebuild every pattern with a Unicode-aware boundary
// so Spanish words ending in an accent (dirá, conclusión) still match.
const B = '(?:(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_]))';
const unicode = (re) => new RegExp(re.source.replaceAll('\\b', B), 'iu');
for (const list of Object.values(PHRASES)) for (const row of list) row[0] = unicode(row[0]);
NOT_X_BUT_Y.forEach((re, i) => (NOT_X_BUT_Y[i] = unicode(re)));

const SCREEN_FIELDS = ['heading', 'subheading', 'label', 'quote'];

const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[\p{L}\p{N}%]+/gu) || [];

function screenTexts(scene) {
  const out = [];
  for (const f of SCREEN_FIELDS) if (scene[f]) out.push([f, scene[f]]);
  (scene.items || []).forEach((it, i) => out.push([`items[${i}]`, it]));
  for (const side of ['left', 'right']) if (scene[side]) out.push([`${side}.text`, scene[side].text]);
  return out;
}

/**
 * @returns {{ score: number, findings: Array<{scene:number|null, field:string, severity:'error'|'warn'|'info', rule:string, message:string, fix:string}> }}
 */
export function lintStoryboard(sb) {
  const findings = [];
  const add = (scene, field, severity, rule, message, fix) => findings.push({ scene, field, severity, rule, message, fix });
  const scenes = Array.isArray(sb?.scenes) ? sb.scenes : [];
  let questions = 0;
  let exclaims = 0;
  let dashes = 0;

  scenes.forEach((sc, i) => {
    const narration = String(sc.narration || '');
    const texts = [['narration', narration], ...screenTexts(sc)];
    for (const [field, text] of texts) {
      const lower = String(text).toLowerCase();
      for (const [group, list] of Object.entries(PHRASES)) {
        for (const [re, label, fix] of list) {
          const m = lower.match(re);
          if (m) add(i, field, 'warn', `slop.${group}`, m[0].trim() === label ? `“${label}”` : `“${m[0].trim()}” (${label})`, fix);
        }
      }
      for (const re of NOT_X_BUT_Y) {
        const m = String(text).match(re);
        if (m) add(i, field, 'warn', 'slop.not-x-but-y', `“${m[0].trim()}”: the “it's not X, it's Y” construction`, 'State Y directly. Contrast only when X is something viewers actually believe.');
      }
    }

    questions += (narration.match(/\?/g) || []).length;
    exclaims += (narration.match(/!/g) || []).length;
    dashes += (narration.match(/[—–]/g) || []).length;

    const n = words(narration).length;
    if (n > 48) add(i, 'narration', 'warn', 'pace.long-scene', `${n} words in one scene (about ${Math.round(n / 2.5)} s)`, 'Split it: one idea per scene, 1–3 sentences.');
    const longest = Math.max(0, ...narration.split(/[.!?]+/).map((s) => words(s).length));
    if (longest > 28) add(i, 'narration', 'info', 'pace.long-sentence', `a ${longest}-word sentence`, 'Shorter sentences are easier to follow by ear.');

    // On-screen text that repeats the narration verbatim.
    const nar = ` ${words(narration).join(' ')} `;
    for (const [field, text] of screenTexts(sc)) {
      if (field === 'quote') continue; // reading a quote aloud is fine
      const w = words(text);
      if (w.length >= 4 && nar.includes(` ${w.join(' ')} `)) {
        add(i, field, 'warn', 'screen.repeats-voice', 'on-screen text repeats the narration word for word', 'Put the gist or the number on screen; let the voice carry the sentence.');
      }
    }

    // Numbers need sources.
    if ((sc.type === 'stat' || sc.type === 'bars') && !String(sc.source || '').trim()) {
      add(i, 'source', 'error', 'facts.unsourced', `${sc.type} scene without a source`, 'Add where the number comes from, or turn the scene into words.');
    }
    if (sc.type === 'quote' && !String(sc.author || '').trim()) {
      add(i, 'author', 'error', 'facts.unattributed', 'quote without an author', 'Attribute it correctly, or drop the quote.');
    }
  });

  if (questions > 3) add(null, 'narration', 'warn', 'voice.questions', `${questions} rhetorical questions`, 'Keep one strong question (usually the hook); answer instead of asking.');
  if (exclaims > 1) add(null, 'narration', 'warn', 'voice.exclamations', `${exclaims} exclamation marks`, 'Let the facts carry the energy; the voice will sound forced.');
  if (dashes > 2) add(null, 'narration', 'info', 'voice.dashes', `${dashes} em dashes in narration`, 'Use full stops or commas: dashes read as “AI writing” and TTS ignores them.');

  const types = scenes.map((s) => s.type);
  for (let i = 2; i < types.length; i++) {
    if (types[i] === types[i - 1] && types[i] === types[i - 2]) {
      add(i, 'type', 'info', 'rhythm.repeat', `three “${types[i]}” scenes in a row`, 'Vary the scene types so the video has rhythm.');
      break;
    }
  }
  if (scenes.length >= 3) {
    const bulletScenes = types.filter((t) => t === 'bullets').length;
    if (bulletScenes / scenes.length > 0.5) add(null, 'type', 'warn', 'rhythm.slideshow', `${bulletScenes} of ${scenes.length} scenes are bullet lists`, 'This reads like a slide deck. Use stats, bars, compare or a quote.');
  }

  const weight = { error: 15, warn: 6, info: 2 };
  const score = Math.max(0, 100 - findings.reduce((a, f) => a + weight[f.severity], 0));
  return { score, findings };
}

/** One line per finding, for the CLI and for feeding back to the LLM. */
export function formatFindings(findings) {
  return findings.map((f) => {
    const where = f.scene == null ? 'whole video' : `scenes[${f.scene}].${f.field}`;
    return `${f.severity.toUpperCase().padEnd(5)} ${where}: ${f.message}. ${f.fix}`;
  });
}
