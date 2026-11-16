# Bible Timeline

A zoomable timeline that works like a map: zoomed out it shows dots and only the key dates;
zooming in brings up titles, then the full entries with pictures. Front end only (Vue 3 + Vite).

## Run it

```bash
npm install
npm run dev      # open the address it prints
npm run build    # makes the dist/ folder to upload to any static host
```

## Live site

https://rojan2003.github.io/bible-timeline/

Every push to `main` rebuilds and republishes the site through GitHub Pages
(`.github/workflows/deploy.yml`). Progress shows under the repository's Actions tab.

## Files

| File | What it is |
|---|---|
| `src/timeline.json` | The data: one entry per date, each with its events, sources and pictures |
| `src/BibleTimeline.vue` | The timeline itself (template, logic and styles in one component) |
| `public/img/` | The pictures, named by number and referenced from `timeline.json` |

## Editing the data

Each date in `timeline.json` looks like this:

```json
{
  "year": -1513,
  "importance": 3,
  "events": [
    { "text": "Full entry text...", "title": "Short label", "sources": "it-1 p. 1216", "images": ["img/5.jpg"] }
  ]
}
```

- `year`: negative for B.C.E., positive for C.E. Add `yearEnd` for a range such as 47-48 C.E.
- `importance`: 1 to 3. Higher numbers keep their label when zoomed out; 1 shows only as a dot until you zoom in.
- `title`: the short label shown on the timeline. These were cut automatically from the text, so rewrite any that read badly.
- `images`: optional list of pictures in `public/img/`.

## Tuning the zoom

Near the top of the script in `BibleTimeline.vue`:

- `TITLES_FROM` and `DETAIL_FROM`: the zoom levels (pixels per year) where titles and full entries appear.
- `MAX_ROWS`: how many rows of labels are allowed above and below the line at each level.
- `SIZES`: label width and height at each level.

## Before publishing

The pictures came from the source document. Check that you have the right to publish them before
making this repository or the built site public.
