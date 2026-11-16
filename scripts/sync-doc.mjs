// Rebuilds src/timeline.json and public/img/ from the Google Doc, so nobody updates them by hand.
//
//   npm run sync                       download the Doc and update the files
//   npm run sync -- --dry-run          show what would change, write nothing
//   npm run sync -- --from file.docx   read a downloaded .docx instead of the live Doc
//
// How the Doc has to be written is explained in the README.

import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import sax from 'sax';
import sharp from 'sharp';

const DOC_ID = process.env.TIMELINE_DOC_ID || '1e2H5bG0DcpLSe4NbQiyWmEmVZM0w-fJIvbcQoSEzp3k';
const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/export?format=docx`;

const MIN_DATES = 100;          // fewer dates than this means the Doc was not read properly: stop, keep the old files
const MAX_WIDTH = 640;          // pictures wider than this are shrunk (smaller ones are never enlarged)
const JPEG_QUALITY = 80;
const TITLE_MAX = 78;           // longest label, in characters
const TITLE_MIN_SENTENCE = 18;  // a first sentence shorter than this ("Nisan 14.") is too short to be the whole label

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_FILE = join(ROOT, 'src', 'timeline.json');
const OVERRIDES_FILE = join(ROOT, 'src', 'overrides.json');
const IMG_DIR = join(ROOT, 'public', 'img');

const DOCUMENT = 'word/document.xml';
const RELATIONS = 'word/_rels/document.xml.rels';
const NUMBERING = 'word/numbering.xml';

let writing = false;   // true once files start being written, so a failure can say whether anything was touched

// ---------- getting the Doc ----------

async function download() {
  let problem;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(DOC_URL, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`Google answered "${res.status} ${res.statusText}"`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      // A .docx is a zip file, and every zip starts with "PK". Anything else is a sign-in or error page.
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new Error('Google sent a web page instead of the document. Is the Doc still shared as "Anyone with the link can view"?');
      }
      return bytes;
    } catch (err) {
      problem = err;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
  throw new Error(`Could not download the Google Doc. ${problem.message}`);
}

function unpack(docx) {
  let files;
  try {
    files = unzipSync(docx, { filter: (f) => [DOCUMENT, RELATIONS, NUMBERING].includes(f.name) || f.name.startsWith('word/media/') });
  } catch (err) {
    throw new Error(`The downloaded file is not a readable .docx (${err.message || err}).`);
  }
  if (!files[DOCUMENT]) throw new Error('The downloaded file is not a Word document (it has no word/document.xml).');
  return files;
}

function walkXml(bytes, { open, text, close }) {
  const parser = sax.parser(true);
  parser.onerror = (err) => { throw err; };
  parser.onopentag = (tag) => open(tag.name, tag.attributes);
  if (text) parser.ontext = text;
  if (close) parser.onclosetag = close;
  parser.write(new TextDecoder().decode(bytes)).close();
}

// The Doc refers to each picture by an id; this maps the id to the picture file inside the .docx.
function readRelations(bytes) {
  const files = new Map();
  if (!bytes) return files;
  walkXml(bytes, {
    open(name, a) {
      if (name === 'Relationship' && a.TargetMode !== 'External' && a.Target) {
        files.set(a.Id, a.Target.startsWith('/') ? a.Target.slice(1) : `word/${a.Target}`);
      }
    },
  });
  return files;
}

// Google Docs likes to turn a typed "1. " into an automatic list, and then the number is no longer part
// of the text. This finds which automatic lists are numbered ones (not bullets), so that their items
// can be treated exactly like paragraphs that start with a typed "1. ".
function readNumberedLists(bytes) {
  const numbered = new Set();
  if (!bytes) return numbered;
  const formats = new Map();   // list definition -> how its top level is marked ("decimal", "bullet" ...)
  let definition = null;
  let level = null;
  let list = null;
  walkXml(bytes, {
    open(name, a) {
      if (name === 'w:abstractNum') definition = a['w:abstractNumId'];
      else if (name === 'w:lvl') level = a['w:ilvl'];
      else if (name === 'w:numFmt' && definition !== null && level === '0') formats.set(definition, a['w:val']);
      else if (name === 'w:num') list = a['w:numId'];
      else if (name === 'w:abstractNumId' && list !== null) {
        const format = formats.get(a['w:val']);
        if (format && format !== 'bullet' && format !== 'none') numbered.add(list);
      }
    },
    close(name) {
      if (name === 'w:abstractNum') definition = null;
      else if (name === 'w:num') list = null;
    },
  });
  return numbered;
}

// Every paragraph in reading order: its style, and its pieces of text and pictures in the order they appear.
function readParagraphs(bytes) {
  const done = [];
  const open = [];      // paragraphs being read (a text box is a paragraph inside a paragraph)
  let inText = false;
  let suggested = 0;    // inside text that was added in "Suggesting" mode and not accepted yet
  walkXml(bytes, {
    open(name, a) {
      const p = open[open.length - 1];
      if (name === 'w:p') open.push({ style: '', parts: [] });
      else if (name === 'w:ins') suggested++;
      else if (!p) return;
      else if (name === 'w:pStyle') p.style = a['w:val'] || '';
      else if (name === 'w:numId') p.list = a['w:val'];             // the paragraph is an item of this automatic list
      else if (name === 'w:ilvl') p.level = Number(a['w:val']) || 0;
      // Suggested additions are left out and suggested deletions (w:delText) are kept: the site shows
      // the Doc as it is until a suggestion is accepted.
      else if (name === 'w:t') inText = !suggested;
      else if (name === 'w:delText') inText = true;
      else if (name === 'w:tab' || name === 'w:br' || name === 'w:cr') p.parts.push(' ');
      else if (name === 'a:blip' && a['r:embed'] && !suggested) p.parts.push({ rel: a['r:embed'], crop: null });
      else if (name === 'a:srcRect') {
        // How much the author cropped off each side, in thousandths of a percent.
        const picture = p.parts[p.parts.length - 1];
        const [l, t, r, b] = ['l', 't', 'r', 'b'].map((side) => Math.max(0, Number(a[side]) || 0));
        if (picture && picture.rel && l + t + r + b > 0 && l + r < 100000 && t + b < 100000) picture.crop = [l, t, r, b];
      }
    },
    text(chunk) {
      if (inText && open.length) open[open.length - 1].parts.push(chunk);
    },
    close(name) {
      if (name === 'w:t' || name === 'w:delText') inText = false;
      else if (name === 'w:ins') suggested--;
      else if (name === 'w:p') done.push(open.pop());
    },
  });
  return done;
}

// ---------- reading dates, events and labels ----------

// Zero-width and other invisible formatting characters out, runs of spaces down to one.
const clean = (s) => s.replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim();

const ERA = String.raw`((?:B\.?\s?C\.?(?:\s?E\.?)?|C\.?\s?E\.?|A\.?\s?D\.?)(?!\p{L}))`;
// "1513 B.C.E."  "33 C.E."  "125 CE"  "47-48 C.E."  "2 B.C.E. - 1 C.E."
const DATE = new RegExp(String.raw`^(\d{1,4})\s*${ERA}?(?:\s*(?:[-–—]|to\b)\s*(\d{1,4}))?\s*${ERA}?`, 'iu');
const STAR = /[★⭐]/u;

// Returns { year, yearEnd, pivotal } for a date heading, or null if the heading is not a date.
function parseHeading(heading) {
  const m = DATE.exec(heading.replace(/^[\s★⭐]+/u, ''));
  if (!m) return null;
  const [, first, firstEra, second, secondEra] = m;
  const lastEra = secondEra || firstEra;
  if (!lastEra) return null;
  const signed = (digits, era) => (/^b/i.test(era) ? -1 : 1) * Number(digits);
  let year = signed(first, second ? firstEra || lastEra : lastEra);
  let yearEnd = second ? signed(second, lastEra) : undefined;
  if (!year || yearEnd === 0) return null;                   // there is no year 0
  if (yearEnd !== undefined && yearEnd < year) [year, yearEnd] = [yearEnd, year];
  if (yearEnd === year) yearEnd = undefined;
  return { year, yearEnd, pivotal: STAR.test(heading) || /\(\s*pivotal\s+date\s*\)/i.test(heading) };
}

// How a date is written in messages: "1513 B.C.E.", "47-48 C.E."
function label(d) {
  const era = (year) => (year < 0 ? 'B.C.E.' : 'C.E.');
  if (!d.yearEnd) return `${Math.abs(d.year)} ${era(d.year)}`;
  const firstEra = era(d.year) === era(d.yearEnd) ? '' : ` ${era(d.year)}`;
  return `${Math.abs(d.year)}${firstEra}-${Math.abs(d.yearEnd)} ${era(d.yearEnd)}`;
}

// A bracket with a scripture reference: it has chapter:verse in it, as in "(Ge 5:3)" or "(see 1Ki 12:19, 20)",
// or it opens with a book name and a number, as in "(Jude 14)". Brackets like "(of Israel)" or "(1657 B.C.E.)" are not.
const SCRIPTURE = /\s*\((?:[^()]*\d\s?:\s?\d|\s*(?:[1-3]\s?)?\p{Lu}\p{L}*\.?\s*\d)/u;

// The short label shown on the timeline, cut from the start of the event text.
function makeTitle(text) {
  let head = text;
  const reference = head.search(SCRIPTURE);
  if (reference > 0) head = head.slice(0, reference);
  // Stop at the end of the first sentence or clause, unless that sits inside brackets or leaves only a word or two.
  let depth = 0;
  for (let i = 0; i < head.length - 1; i++) {
    const c = head[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && '.;!?'.includes(c) && /\s/.test(head[i + 1])) {
      if (i >= TITLE_MIN_SENTENCE) head = head.slice(0, i);
      break;
    }
  }
  head = head.replace(/[\s.,;:]+$/, '');
  if (head.length > TITLE_MAX) head = `${head.slice(0, TITLE_MAX).replace(/\s+\S*$/, '').replace(/[\s.,;:]+$/, '')}…`;
  return head;
}

// Turns the paragraphs into the list of dates. pictureFor(part) gives the file name for a picture, or null.
function buildDates(paragraphs, numberedLists, pictureFor, warnings) {
  const byYear = new Map();   // the same year under two headings ends up as one date
  let date = null;            // the date heading we are under; null before the first one and under a heading that is not a date
  let event = null;           // the event being read
  let waiting = [];           // pictures seen since the last event: they belong to the next one

  for (const p of paragraphs) {
    const text = clean(p.parts.filter((part) => typeof part === 'string').join(''));

    if (/^(title|heading\s*\d)$/i.test(p.style)) {
      const isDateStyle = /^heading\s*2$/i.test(p.style);
      const parsed = isDateStyle ? parseHeading(text) : null;
      event = null;
      date = null;
      if (parsed) {
        const key = `${parsed.year}|${parsed.yearEnd ?? ''}`;
        date = byYear.get(key) || { year: parsed.year, yearEnd: parsed.yearEnd, pivotal: false, events: [] };
        date.pivotal ||= parsed.pivotal;
        byYear.set(key, date);
      } else if (isDateStyle && text) {
        warnings.push(`The heading "${text}" is not a date like "1513 B.C.E." or "47-48 C.E.", so it and the text under it were left out.`);
      }
      continue;
    }
    if (!date) continue;

    for (const part of p.parts) {
      const name = typeof part === 'string' ? null : pictureFor(part);
      if (name) waiting.push(name);
    }
    if (!text) continue;

    const source = /^sources?\s*:\s*(.*?)[\s;,]*$/i.exec(text);   // without the ";" often left dangling at the end
    const numbered = /^\d{1,2}\.(?:\s+(.*))?$/.exec(text);           // a typed "1. "
    const listItem = !p.level && numberedLists.has(p.list);          // or a number Docs added by itself
    if (source) {
      if (!event) warnings.push(`${label(date)}: a "Sources:" line has no event above it, so it was left out.`);
      else if (source[1]) event.sources.push(source[1]);
    } else if (numbered || listItem || !event) {
      event = { text: numbered ? numbered[1] || '' : text, sources: [], images: waiting };
      waiting = [];
      date.events.push(event);
    } else {
      event.text = `${event.text} ${text}`.trim();   // an unnumbered paragraph continues the event above it
    }
  }
  if (waiting.length) warnings.push(`${waiting.length} picture(s) at the end of the Doc have no event after them, so they were left out.`);

  const dates = [];
  for (const d of byYear.values()) {
    const events = d.events.filter((e) => e.text).map((e) => ({
      text: e.text,
      ...(e.sources.length && { sources: e.sources.join('; ') }),
      ...(e.images.length && { images: [...new Set(e.images)].map((name) => `img/${name}`) }),
      title: makeTitle(e.text),
    }));
    if (!events.length) {
      warnings.push(`${label(d)} has no text under it yet, so it was left out.`);
      continue;
    }
    dates.push({
      year: d.year,
      events,
      ...(d.yearEnd !== undefined && { yearEnd: d.yearEnd }),
      importance: d.pivotal ? 3 : events.length >= 2 ? 2 : 1,
    });
  }
  // The app expects the dates in order, earliest first.
  return dates.sort((a, b) => a.year - b.year || (a.yearEnd ?? a.year) - (b.yearEnd ?? b.year));
}

// ---------- pictures ----------

// Google renumbers the pictures (image1.png, image2.png ...) differently in every download, so a
// picture is named after a fingerprint of its own contents: the same picture always gets the same name.
function pictureName(bytes, crop) {
  const fingerprint = createHash('sha256').update(bytes).update(`|${crop ? crop.join(',') : ''}|${MAX_WIDTH}`);
  return `${fingerprint.digest('hex').slice(0, 12)}.jpg`;
}

async function toJpeg(bytes, crop) {
  let image = sharp(bytes);
  if (crop) {
    const { width, height } = await image.metadata();
    const [l, t, r, b] = crop.map((v) => v / 100000);
    image = image.extract({
      left: Math.round(width * l),
      top: Math.round(height * t),
      width: Math.max(1, Math.round(width * (1 - l - r))),
      height: Math.max(1, Math.round(height * (1 - t - b))),
    });
  }
  return image
    .flatten({ background: '#ffffff' })   // JPEG has no transparency
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

// ---------- manual choices ----------

// src/overrides.json holds what was chosen by hand ("importance", "title") for a date. It is applied
// last, so a sync never undoes it. Keys are written like the Doc headings: "1513 B.C.E.", "47-48 C.E.".
async function applyOverrides(dates, warnings) {
  let overrides;
  try {
    overrides = JSON.parse((await readFile(OVERRIDES_FILE, 'utf8')).replace(/^\p{Cf}+/u, ''));
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw new Error(`src/overrides.json could not be read: ${err.message}`);
  }
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('src/overrides.json must be a list of dates in curly brackets, like { "1513 B.C.E.": { "importance": 3 } }.');
  }
  for (const [name, change] of Object.entries(overrides)) {
    const wanted = /^-?\d+$/.test(name.trim()) ? { year: Number(name) } : parseHeading(clean(name));
    const date = wanted && dates.find((d) => d.year === wanted.year && d.yearEnd === wanted.yearEnd);
    if (!date) {
      warnings.push(`overrides.json: "${name}" matches no date in the Doc, so it was ignored.`);
      continue;
    }
    const { importance, title } = change || {};
    if ([1, 2, 3].includes(importance)) date.importance = importance;
    else if (importance !== undefined) warnings.push(`overrides.json: "${name}" has an importance that is not 1, 2 or 3, so it was ignored.`);
    if (typeof title === 'string' && clean(title)) date.events[0].title = clean(title);   // the app shows the first event's title
  }
}

// ---------- what changed ----------

function describeChanges(before, after) {
  const key = (d) => `${d.year}|${d.yearEnd ?? ''}`;
  const old = new Map(before.map((d) => [key(d), d]));
  const now = new Set(after.map(key));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const changed = [];
  for (const d of after) {
    const was = old.get(key(d));
    if (!was || same(was, d)) continue;
    const what = [];
    if (was.events.length !== d.events.length) what.push(`${was.events.length} -> ${d.events.length} events`);
    else {
      for (const [field, word] of [['text', 'text'], ['sources', 'sources'], ['images', 'pictures'], ['title', 'label']]) {
        if (d.events.some((e, i) => !same(e[field], was.events[i][field]))) what.push(word);
      }
    }
    if (was.importance !== d.importance) what.push(`importance ${was.importance} -> ${d.importance}`);
    changed.push(`${label(d)} (${what.join(', ')})`);
  }
  return {
    added: after.filter((d) => !old.has(key(d))).map(label),
    removed: before.filter((d) => !now.has(key(d))).map(label),
    changed,
  };
}

async function readCurrent() {
  let json = '';
  let pictures = [];
  // Git on Windows may hand the file back with Windows line endings; that is not a change.
  try { json = (await readFile(JSON_FILE, 'utf8')).replace(/\r\n/g, '\n'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  try { pictures = (await readdir(IMG_DIR)).filter((f) => /\.jpe?g$/i.test(f)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  let dates = [];
  try { dates = json ? JSON.parse(json) : []; } catch { /* an unreadable old file is simply replaced */ }
  return { json, dates, pictures };
}

// ---------- the sync ----------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
  if (args.includes('--from') && !from) throw new Error('--from needs the path of a .docx file.');

  console.log(from ? `Reading ${from} ...` : 'Downloading the Google Doc ...');
  const files = unpack(from ? new Uint8Array(await readFile(from)) : await download());
  const relations = readRelations(files[RELATIONS]);
  const warnings = [];

  // 1. Work everything out in memory. Nothing on disk is touched until all of it has succeeded.
  const sources = new Map();   // picture file name -> where it comes from in the .docx
  const pictureFor = ({ rel, crop }) => {
    const bytes = files[relations.get(rel)];
    if (!bytes) return null;
    const name = pictureName(bytes, crop);
    sources.set(name, { bytes, crop });
    return name;
  };
  const dates = buildDates(readParagraphs(files[DOCUMENT]), readNumberedLists(files[NUMBERING]), pictureFor, warnings);
  if (dates.length < MIN_DATES) {
    throw new Error(`Only ${dates.length} dates were found in the Doc; at least ${MIN_DATES} are expected. `
      + 'Are the dates still written as "Heading 2", like "1513 B.C.E."?');
  }

  const current = await readCurrent();
  const used = () => new Set(dates.flatMap((d) => d.events.flatMap((e) => e.images || [])).map((path) => path.slice('img/'.length)));
  const fresh = new Map();     // pictures that are not in public/img yet
  for (const name of used()) {
    if (current.pictures.includes(name)) continue;
    try {
      fresh.set(name, await toJpeg(sources.get(name).bytes, sources.get(name).crop));
    } catch (err) {
      warnings.push(`One picture could not be converted to JPEG and was left out (${err.message}).`);
      for (const d of dates) for (const e of d.events) {
        if (!e.images) continue;
        e.images = e.images.filter((path) => path !== `img/${name}`);
        if (!e.images.length) delete e.images;
      }
    }
  }
  const wanted = used();
  const stale = current.pictures.filter((name) => !wanted.has(name));

  await applyOverrides(dates, warnings);
  const json = JSON.stringify(dates, null, 1);   // same layout as the file has always had

  // 2. Report.
  const count = (list) => list.reduce((n, d) => n + d.events.length, 0);
  const { added, removed, changed } = describeChanges(current.dates, dates);
  const upToDate = json === current.json && !fresh.size && !stale.length;
  const lines = upToDate
    ? [`Already up to date: ${dates.length} dates, ${count(dates)} events, ${wanted.size} pictures. The Doc has not changed.`]
    : [
      `Dates: ${dates.length} (was ${current.dates.length})   Events: ${count(dates)} (was ${count(current.dates)})   Pictures: ${wanted.size} (was ${current.pictures.length})`,
      `Dates added: ${added.length}${added.length ? ` - ${added.join(', ')}` : ''}`,
      `Dates removed: ${removed.length}${removed.length ? ` - ${removed.join(', ')}` : ''}`,
      `Dates changed: ${changed.length}`,
      ...changed.map((line) => `  ${line}`),
      `Pictures: ${fresh.size} new, ${stale.length} removed`,
    ];
  if (warnings.length) lines.push('', 'Worth checking in the Doc:', ...warnings.map((w) => `  - ${w}`));
  console.log(`\n${lines.join('\n')}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Timeline sync\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
  }
  if (dryRun) return console.log('Dry run: nothing was written.');
  if (upToDate) return;

  // 3. Write. New pictures first and old ones last, so timeline.json never points at a missing picture.
  writing = true;
  await mkdir(IMG_DIR, { recursive: true });
  for (const [name, jpeg] of fresh) await writeFile(join(IMG_DIR, name), jpeg);
  if (json !== current.json) {
    await writeFile(`${JSON_FILE}.tmp`, json);
    await rename(`${JSON_FILE}.tmp`, JSON_FILE);
  }
  for (const name of stale) await rm(join(IMG_DIR, name));
  console.log('Updated src/timeline.json and public/img/.');
}

main().catch((err) => {
  console.error(`\nSync failed: ${err.message}`);
  console.error(writing
    ? 'It failed while writing, so src/timeline.json and public/img/ may be half updated. Run the sync again.'
    : 'Nothing was changed: src/timeline.json and public/img/ are as they were.');
  process.exitCode = 1;
});
