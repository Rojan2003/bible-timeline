# Bible Timeline

A zoomable timeline that works like a map: zoomed out it shows dots and only the key dates;
zooming in brings up titles, then the full entries with pictures.

**Live site:** https://rojan2003.github.io/bible-timeline/

## Where the content comes from

Everything on the timeline (dates, text, sources, pictures) is written in one Google Doc:

https://docs.google.com/document/d/1e2H5bG0DcpLSe4NbQiyWmEmVZM0w-fJIvbcQoSEzp3k/edit

Once an hour the site reads that Doc and rebuilds itself. **To change the timeline, edit the Doc.**
There is nothing else to do and no code to touch.

## Writing in the Doc

A finished date looks like this in the Doc:

```
1513 B.C.E. ★                                    <- the date, in the style "Heading 2"
[picture]                                        <- a picture, on its own line ABOVE its event
1. Israel leaves Egypt (Ex 12:40, 41)            <- first event
Sources: it-1 p. 776                             <- where it comes from
2. The Law covenant is made at Sinai (Ex 24:6-8) <- second event
Sources: si p. 20
```

### Add a date

1. On a new line, type the date: `1513 B.C.E.`, `33 C.E.` or `125 CE`.
   For a span of years, write `47-48 C.E.`
2. Change that line's style to **Heading 2** (the box in the toolbar that normally says
   "Normal text"). This is how the site knows the line is a date. A date that is not Heading 2
   is not seen.
3. On the lines below, write what happened.

You can add the date anywhere in the Doc. The site puts the dates in order by itself. If the same
year appears under two headings, the site joins them into one date.

### One event or several

- **One event:** just write the text under the date.
- **Several events in the same year:** start each one with a number, a full stop and a space:
  `1. `, `2. `, `3. ` It does not matter whether you type the numbers yourself or let Google Docs
  number the list for you.
- Text without a number belongs to the event above it.

### Sources

Under an event, add a line that starts with `Sources:` (or `Source:`). It is shown under that event.

### Pictures

Put the picture **on its own line, directly above the event it belongs to** (Insert > Image).
A picture always goes with the event that comes right after it.

- A picture placed *below* an event goes to the next event instead. A picture at the very end of
  the Doc has no event after it, so it is not shown.
- If you crop a picture in the Doc, the site shows the cropped picture.
- If you delete a picture from the Doc, it disappears from the site.

### Mark a key date

Add a star to the date heading: `1513 B.C.E. ★` (copy the star from here, or use Insert >
Special characters and search for "star"). Writing `(Pivotal Date)` in the heading does the same.

Key dates are shown in a different colour and keep their label even when the timeline is zoomed
all the way out.

### The short label

On the timeline each date shows a short label. It is cut automatically from the start of the
first event: it stops before the first scripture reference in brackets, such as `(Ex 12:41)`, or
at the end of the first sentence, and is never longer than about 78 characters. So put the main
point first: "Israel leaves Egypt (Ex 12:41)" gives the label "Israel leaves Egypt".

### Good to know

- A Heading 2 that is not a date (for example "Introduction") is skipped, together with the text
  under it.
- A date with nothing written under it yet is left out until it has text.
- Text added in "Suggesting" mode is not published until the suggestion is accepted.
- The Doc must stay shared as "Anyone with the link can view". If that is switched off, the site
  simply stays as it is until it is switched back on.

## How long until an edit is online?

**Usually within about an hour.** The site checks the Doc once an hour, at about 17 minutes past
the hour, and a change is online two or three minutes after that. So an edit made at 10:10 is
online around 10:20, and an edit made at 10:20 is online around 11:20. GitHub sometimes starts
the hourly check a few minutes late when it is busy.

If the change does not show, refresh the page: a browser can keep the old version for up to
10 minutes.

## Force an update now

You need a GitHub account with access to this repository.

1. Open https://github.com/Rojan2003/bible-timeline/actions
2. In the list on the left, click **Sync from Google Doc and deploy**.
3. Click **Run workflow** (on the right), then the green **Run workflow** button.
4. Wait about two minutes for the green tick. The site is now up to date.

## Checking what happened

Every check is listed at https://github.com/Rojan2003/bible-timeline/actions. A green tick means
it worked, a red cross means it did not (the site then stays exactly as it was). Click a run to see
a box called **Timeline sync**: it lists the dates that were added, removed or changed, and under
"Worth checking in the Doc" anything that looked wrong, such as a heading that is not a date or a
picture with no event after it.

If the hourly checks stop appearing: GitHub pauses them when a repository has had no changes for
60 days, and emails the owner. Open the page above, click **Sync from Google Doc and deploy**, and
press **Enable workflow**.

## Install it as an app

The site is a PWA: it can be installed and it opens without a connection.

- **Android (Chrome):** open the site, tap the ⋮ menu, then **Add to Home screen** or **Install app**.
- **iPhone / iPad (Safari):** tap the Share button, then **Add to Home Screen**.
- **Computer (Chrome or Edge):** click the install icon at the right end of the address bar.

After the first visit the timeline, the Kings and Prophets page and all the pictures are saved on
the device. When there is a connection the app picks up the newest version by itself; a change may
need the app to be opened twice before it shows.

## Choices made by hand: `src/overrides.json`

Two things can be set by hand in this file, and a sync never undoes them: how important a date
is, and its short label.

```json
{
  "1513 B.C.E.": { "importance": 3 },
  "33 C.E.": { "importance": 3, "title": "Jesus dies and is resurrected" }
}
```

- Write the date exactly as in the Doc heading: `"1513 B.C.E."`, `"33 C.E."`, `"47-48 C.E."`.
- `importance`: `3` is a key date (the same as ★ in the Doc), `2` keeps its label when zoomed
  out, `1` is a dot until you zoom in. Without an entry here, a date is 3 if its heading has ★,
  otherwise 2 if it has two or more events, otherwise 1.
- `title`: replaces the automatic short label of the date.
- This file wins over the Doc. To stop a date being a key date, remove it here *and* remove the
  ★ from the Doc.

---

## For developers

Front end only: Vue 3 + Vite.

```bash
npm install
npm run dev                  # open the address it prints
npm run build                # makes the dist/ folder
npm run sync                 # rebuild src/timeline.json and public/img/ from the Google Doc
npm run sync -- --dry-run    # only show what would change
```

### Files

| File | What it is |
|---|---|
| `scripts/sync-doc.mjs` | Downloads the Doc as .docx and generates the two things below |
| `src/timeline.json` | Generated. One entry per date, each with its events, sources and pictures |
| `public/img/` | Generated. The pictures from the Doc as JPEGs, at most 640 px wide |
| `src/overrides.json` | Hand-made choices that are applied after every sync (see above) |
| `src/BibleTimeline.vue` | The timeline itself (template, logic and styles in one component) |
| `src/KingsProphets.vue` | The Kings and Prophets page (tabs, the kings' story cards, the prophets) |
| `src/KingsTimeline.vue` | The zoomable view on that page: Judah's kings, the prophets and Israel's kings as bars |
| `src/kings-prophets.json` | Hand-written. The text for that page: the kings in story order, and the prophets |
| `src/App.vue` | Switches between the two pages (`#/` timeline, `#/kings` kings and prophets) |
| `public/manifest.webmanifest`, `public/icons/` | The app's name, colours and icons for installing it |
| `public/sw.js` | Service worker: saves the site for offline use. Only runs in the built site, not in `npm run dev` |
| `.github/workflows/sync-and-deploy.yml` | Runs the sync and publishes the site |

Do not edit `src/timeline.json` or `public/img/` by hand: the next sync overwrites them.

### The sync

`npm run sync` downloads the Doc, works everything out in memory, and only then writes. It stops
with an error and leaves the files untouched if the download fails, if the result has fewer than
100 dates, or if `src/overrides.json` is not valid JSON.

Google numbers the pictures differently in every download, so each picture file is named after a
fingerprint of its contents (`public/img/3fa9c1d2e0b7.jpg`). The same picture always gets the same
name, and a sync of an unchanged Doc changes no files.

Each date in `timeline.json` looks like this:

```json
{
  "year": -1513,
  "events": [
    { "text": "Full entry text...", "sources": "it-1 p. 776", "images": ["img/3fa9c1d2e0b7.jpg"], "title": "Short label" }
  ],
  "importance": 3
}
```

`year` is negative for B.C.E.; a range such as 47-48 C.E. also has `yearEnd`.

### Publishing

`.github/workflows/sync-and-deploy.yml` runs every hour, on every push to `main`, and from the
"Run workflow" button. It runs the sync, commits `src/timeline.json` and `public/img/` if they
changed, then builds and deploys to GitHub Pages. An hourly run that finds no change in the Doc
commits nothing and publishes nothing; a push or the button always publishes.

### The Kings and Prophets page

Opened with the "Kings and prophets" button on the timeline, or directly at `#/kings`. It is not
part of the Google Doc sync: all its wording is in `src/kings-prophets.json`, edited by hand.

The page has three tabs: a zoomable timeline of the reigns (tap one for its details), the kings'
story as cards to read from top to bottom, and the prophets.

Every king has the same fields:

- `reputation`: `good`, `mixed` or `bad`, with the Bible's own `verdict` and its verse.
- `story`: what happened in the reign.
- `faced`: the circumstances he faced (a short list).
- `learn`: what we can learn from him.
- `next`: one line that leads into the next king, so the cards read as one story. Kings are
  shown in the order they appear in the file.
- `from` and `to`: where the bar starts and ends on the zoomable view (negative for B.C.E.).
- `year`: used by the "See on the timeline" link (`#/timeline?y=-997` opens the timeline there).

Every prophet has `situation` (what was going on when he began), `start` (how he began) and
`message`.

The content was taken only from jw.org and wol.jw.org. Dates follow chart A6 of the New World
Translation, so a few differ by a year from the timeline.

### Tuning the zoom

Near the top of the script in `BibleTimeline.vue`:

- `TITLES_FROM` and `DETAIL_FROM`: the zoom levels (pixels per year) where titles and full entries appear.
- `MAX_ROWS`: how many rows of labels are allowed above and below the line at each level.
- `SIZES`: label width and height at each level.

### Before publishing

The pictures come from the source document. Check that you have the right to publish them before
making this repository or the built site public.
