# Updating the ZC Kugelman Interiors website

The live site uses the **Classic Brownstone** look: cream paper, a deep green header, burgundy accents, and traditional serif type (EB Garamond for text, Cinzel for small labels). Those fonts are loaded from Google Fonts in `index.html`. Other design directions are still available under `/options/` and are not used on the main site.

Everything is plain HTML, CSS and JS. There is no build step. Edit a file, refresh, and you're done.

```
zc-site/
  index.html            page layout and text
  css/style.css         Classic Brownstone look and animations
  js/config.js          BRAND NAME, phone, email, form, counters   <- edit me
  js/main.js            behavior (normally you don't touch this)
  data/projects.json    Past Projects (one entry per job)
  data/concepts.json    Design Concepts gallery
  images/hero/          hero image
  images/projects/<slug>/         photos for each job
  images/projects/<slug>/plans/   floor plans / layout drawings for that job (optional)
  images/concepts/      concept renderings
  scripts/add_project.py    adds a job from a folder of photos
```

## Preview it locally
The site loads its JSON with `fetch`, so it must be served instead of double-clicked:

```
cd zc-site
python3 -m http.server 8000
# open http://localhost:8000
```

## Rename the business / add contact details
Open `js/config.js` and change `brandName`, `brandShort`, `tagline`, `phone`, `email`.
The name updates everywhere on the page. (Also update the `<title>` and `og:` tags at the top of `index.html` for search engines and link previews.)

Contact form: create a free form at formspree.io and paste its URL into `formEndpoint`.
If you leave it blank and set a real `email`, the form opens the visitor's email app instead.

## Add a finished job (the easy way)
1. Put the job's photos in a folder. Name them in order (`1.jpg`, `2.jpg`...) because the first one becomes the cover.
2. Run:
```
python3 scripts/add_project.py ~/Desktop/midwood-kitchen \
  --title "Kosher Kitchen Renovation" --neighborhood "Midwood" --year 2026 \
  --categories "Kitchens,Dining" --scope "Layout,Cabinetry,Lighting" \
  --summary "A two-zone kosher kitchen for a big family." \
  --description "The story of the project..." \
  --plans ~/Desktop/midwood-kitchen-plans
```
It copies and resizes the photos into `images/projects/<slug>/`, copies any floor plans into `images/projects/<slug>/plans/`, and adds the entry to `data/projects.json` at the top.
`--plans` is optional. It accepts JPG, PNG, WEBP or SVG. For a PDF plan, export each page to JPG or PNG first. The file name becomes the caption (`ground-floor.png` becomes "ground floor"), so name them well or edit the captions in the JSON afterward.
Pillow (`pip install pillow`) is optional. It's used for resizing, and `pillow-heif` adds iPhone HEIC support.

## Add a job by hand
1. Make a folder `images/projects/my-job-name/` and drop the photos in.
2. Copy an entry in `data/projects.json` and edit it:
```json
{
  "slug": "my-job-name",
  "title": "Boro Park Dining Room",
  "neighborhood": "Boro Park",
  "year": "2026",
  "categories": ["Dining"],
  "scope": ["Furniture", "Lighting", "Window treatments"],
  "summary": "One line for the card.",
  "description": "Longer story. Blank line = new paragraph.",
  "cover": "images/projects/my-job-name/01.jpg",
  "images": [
    { "src": "images/projects/my-job-name/01.jpg", "alt": "Describe the photo", "caption": "Shown in the lightbox" }
  ],
  "plans": [
    { "src": "images/projects/my-job-name/plans/plan-01.jpg", "alt": "Ground floor plan", "caption": "Ground floor, after" }
  ]
}
```
Filter buttons are created automatically from `categories`.
`plans` is optional. When present, the project card shows a "Floor plan included" tag, the detail view gets a "Floor plans & layouts" section, and the plans appear in the lightbox after the photos.
Before/after plans work well: add two entries with captions like "Before" and "After".

## The animated floor plan section
The self-drawing plan in "The Plan" section is an **illustrative example**, not a real home. It's an inline SVG in `index.html` inside `<figure class="plan-figure">`.
Each `<g data-g="..." data-from="0.02" data-to="0.30">` group draws its lines between those scroll points (0 = section start, 1 = end). Lines need `class="dr"` and `pathLength="1"`, and labels go in `<g class="lbl">`.
To show a real plan there later, replace the SVG with your own following the same pattern, or just put a plain `<img>` in its place.

## Remove the SAMPLE projects
Once you have real jobs, run `python3 scripts/add_project.py --remove-samples`
(or delete the entries with `"sample": true` and their image folders).

## Add a concept image
Put the image in `images/concepts/` and add an entry to `data/concepts.json`:
```json
{ "src": "images/concepts/new-idea.jpg", "title": "Pesach Kitchen Concept", "room": "Kitchen", "description": "Short caption." }
```
This gallery is for concept renderings and layout ideas. Real project photos belong in Projects.

## Publish
Upload the whole `zc-site` folder to Netlify (drag and drop), GitHub Pages, Cloudflare Pages or any web host.
No server code is needed.
