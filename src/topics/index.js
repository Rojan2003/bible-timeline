// One index of everything that has a place in time, across all the timelines, so that any item
// can show what was happening "at the same time" elsewhere and link straight to it.
import jesus from './jesus.json';
import paul from './paul.json';
import books from './books.json';
import powers from './powers.json';
import patriarchs from './patriarchs.json';
import judges from './judges.json';
import northSouth from './north-south.json';
import KP from '../kings-prophets.json';
import PERIODS from '../periods.json';

// The calendar has no year zero, so 1 B.C.E. sits at 0 and 1 C.E. at 1 on the number line.
export const cont = (y, f = 0) => (y < 0 ? y + 1 : y) + f;
export const fmtYear = (c) => { const r = Math.floor(c); return r <= 0 ? (1 - r) + ' B.C.E.' : r + ' C.E.'; };

function prepare(t) {
  const lanes = Object.fromEntries(t.lanes.map((l) => [l.id, l]));
  const items = t.items.map((d) => {
    const c0 = cont(d.y, d.f || 0);
    const bar = d.y2 !== undefined;
    return { ...d, c0, c1: bar ? cont(d.y2, d.f2 || 0) : c0, bar, laneLabel: lanes[d.lane].label };
  });
  return { ...t, c0: cont(t.min.y, t.min.f), c1: cont(t.max.y, t.max.f), items };
}
export const topics = [patriarchs, judges, powers, northSouth, books, jesus, paul].map(prepare);
export const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));

// The pages, in the order shown in the navigation.
export const pages = [
  { id: 'timeline', label: 'Main timeline', href: '#/' },
  { id: 'kings', label: 'Kings and prophets', href: '#/kings' },
  ...topics.map((t) => ({ id: t.id, label: t.short, href: '#/t/' + t.id })),
];

// ---- everything, flattened ----
const all = [];
for (const k of KP.kings) all.push({ key: 'kings:k-' + k.id, group: k.kingdom === 'judah' ? 'Kings of Judah' : 'Kings of Israel', name: k.name, c0: cont(k.from), c1: cont(k.to), bar: true, href: '#/kings?sel=k-' + k.id });
for (const p of KP.prophets) all.push({ key: 'kings:p-' + p.id, group: 'Prophets', name: p.name, c0: cont(p.from), c1: cont(p.to), bar: true, href: '#/kings?sel=p-' + p.id });
for (const t of topics) {
  for (const d of t.items) {
    if (d.noCross) continue;
    const group = t.id === 'books' ? 'Bible books completed' : t.id === 'powers' && d.lane === 'power' ? 'World power'
      : t.id === 'paul' && d.lane === 'letters' ? 'Paul’s letters' : t.id === 'patriarchs' && d.lane === 'lives' ? 'Alive at the time' : t.id === 'north-south' ? (d.lane === 'north' ? 'King of the north' : d.lane === 'south' ? 'King of the south' : d.lane === 'org' ? 'World organization' : 'Daniel 11 events') : t.id === 'powers' ? 'World events' : t.id === 'jesus' ? 'In the life of Jesus' : t.id === 'paul' ? 'Paul and the congregation' : t.title;
    all.push({ key: t.id + ':' + d.id, group, name: d.name, c0: d.c0, c1: d.c1, bar: d.bar, rank: d.rank || 1, href: '#/t/' + t.id + '?sel=' + d.id });
  }
}
const periods = PERIODS.map((p) => ({ key: 'period:' + p.id, group: 'Period on the main timeline', name: p.title, c0: cont(p.from), c1: cont(p.to), bar: true, href: '#/timeline?y=' + p.from + '&info=1' }));

const ORDER = ['Period on the main timeline', 'World power', 'King of the north', 'King of the south', 'World organization', 'Kings of Judah', 'Kings of Israel', 'Prophets', 'Alive at the time', 'Bible books completed', 'Paul’s letters'];
const MAX = 7;

// What overlaps the years c0..c1 (number-line years), grouped, leaving out `selfKey` and anything
// from `selfTopic`. A point in time is widened a little so that "the same year" still matches.
export function relatedFor(c0, c1, selfKey, selfTopic) {
  const point = c1 - c0 < 0.02;
  const a = point ? c0 - 0.5 : c0, b = point ? c1 + 0.5 : c1;
  const groups = new Map();
  for (const x of [...periods, ...all]) {
    if (x.key === selfKey || (selfTopic && x.key.startsWith(selfTopic + ':'))) continue;
    const hit = x.bar ? x.c0 < b && x.c1 > a : x.c0 >= a && x.c0 <= b;
    if (!hit) continue;
    const overlap = Math.min(x.c1, b) - Math.max(x.c0, a);
    if (!groups.has(x.group)) groups.set(x.group, []);
    groups.get(x.group).push({ ...x, overlap });
  }
  const out = [];
  for (const [label, list] of groups) {
    // Most important first, then longest overlap, then show them in time order.
    const top = list.sort((p, q) => (q.rank || 2) - (p.rank || 2) || q.overlap - p.overlap).slice(0, MAX).sort((p, q) => p.c0 - q.c0);
    out.push({ label, items: top, more: list.length - top.length });
  }
  const pos = (g) => { const i = ORDER.indexOf(g.label); return i < 0 ? ORDER.length : i; };
  return out.sort((p, q) => pos(p) - pos(q));
}

// The timelines whose years overlap c0..c1, for the "About these years" cards.
export function topicsFor(c0, c1) {
  const list = topics.filter((t) => t.c0 < c1 && t.c1 > c0).map((t) => ({ id: t.id, label: t.short, href: '#/t/' + t.id }));
  if (cont(-997) < c1 && cont(-607) > c0) list.unshift({ id: 'kings', label: 'Kings and prophets', href: '#/kings' });
  return list;
}
