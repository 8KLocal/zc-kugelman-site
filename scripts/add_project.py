#!/usr/bin/env python3
"""
Add a finished job to the website from a folder of photos.

Usage (run from anywhere):
  python3 scripts/add_project.py "/path/to/photos" \
      --title "Kosher Kitchen Renovation" \
      --neighborhood "Midwood" \
      --year 2026 \
      --categories "Kitchens,Dining" \
      --scope "Kitchen layout,Cabinetry,Lighting" \
      --summary "A two-zone kosher kitchen for a family of eight." \
      --description "Longer story of the project. Use a blank line between paragraphs." \
      --plans "/path/to/floor-plans"          # optional: floor plans / layout drawings

What it does:
  1. Makes images/projects/<slug>/ and copies the photos in as 01.jpg, 02.jpg, ...
     (resized to max 2000px wide and compressed, if Pillow is installed; otherwise copied as-is).
     Floor plans (optional, --plans folder) go to images/projects/<slug>/plans/plan-01.jpg, ...
     .svg plans are copied as-is. PDFs: export each page to JPG/PNG first.
  2. Adds an entry to data/projects.json (the newest project goes first).
  The first photo is the cover. Use --cover 3 to pick a different one.
  Use --replace to overwrite an existing project with the same slug.

Other helpers:
  python3 scripts/add_project.py --list            # list current projects
  python3 scripts/add_project.py --remove-samples  # delete the SAMPLE entries and their images
"""
import argparse, json, os, re, shutil, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(SITE, "data", "projects.json")
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".JPG", ".JPEG", ".PNG", ".WEBP", ".HEIC")
PLAN_EXT = IMG_EXT + (".svg", ".SVG")

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "project"

def load():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)

def save(d):
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")

def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]

def copy_photo(src, dst_noext, max_px=2000):
    if src.lower().endswith(".svg"):
        out = dst_noext + ".svg"
        shutil.copy2(src, out)
        return out
    try:
        from PIL import Image, ImageOps
        try:
            import pillow_heif; pillow_heif.register_heif_opener()
        except Exception:
            pass
        im = Image.open(src)
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((max_px, max_px))
        out = dst_noext + ".jpg"
        im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
        return out
    except Exception as e:
        if src.lower().endswith(".heic"):
            print(f"  ! Skipped {os.path.basename(src)}: HEIC needs 'pip install pillow pillow-heif' ({e})")
            return None
        out = dst_noext + os.path.splitext(src)[1].lower()
        shutil.copy2(src, out)
        return out

def main():
    ap = argparse.ArgumentParser(description="Add a past project to the website.")
    ap.add_argument("photos", nargs="?", help="Folder containing the job photos")
    ap.add_argument("--title")
    ap.add_argument("--neighborhood", default="")
    ap.add_argument("--year", default="")
    ap.add_argument("--categories", default="", help="Comma separated, e.g. 'Kitchens,Dining'")
    ap.add_argument("--scope", default="", help="Comma separated list of what was done")
    ap.add_argument("--summary", default="")
    ap.add_argument("--description", default="")
    ap.add_argument("--plans", help="Optional folder of floor plans / layout drawings (jpg, png, webp, svg)")
    ap.add_argument("--slug", help="Folder/URL name (default: made from the title)")
    ap.add_argument("--cover", type=int, default=1, help="Which photo number is the cover (default 1)")
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--remove-samples", action="store_true")
    a = ap.parse_args()

    d = load()
    projects = d.setdefault("projects", [])

    if a.list:
        for p in projects:
            print(("[SAMPLE] " if p.get("sample") else "") + f"{p['slug']}: {p['title']} ({len(p.get('images', []))} photos, {len(p.get('plans', []))} plans)")
        return
    if a.remove_samples:
        keep = []
        for p in projects:
            if p.get("sample"):
                shutil.rmtree(os.path.join(SITE, "images", "projects", p["slug"]), ignore_errors=True)
                print("Removed", p["slug"])
            else:
                keep.append(p)
        d["projects"] = keep; save(d); return

    if not a.photos or not a.title:
        ap.error("a photos folder and --title are required")
    src = os.path.abspath(os.path.expanduser(a.photos))
    if not os.path.isdir(src):
        sys.exit(f"Not a folder: {src}")
    files = sorted([f for f in os.listdir(src) if f.endswith(IMG_EXT) and not f.startswith(".")], key=natural_key)
    if not files:
        sys.exit("No photos (.jpg/.png/.webp/.heic) found in that folder.")

    slug = slugify(a.slug or a.title)
    if any(p["slug"] == slug for p in projects):
        if not a.replace:
            sys.exit(f"A project with slug '{slug}' already exists. Use --replace or --slug.")
        projects[:] = [p for p in projects if p["slug"] != slug]
    dest = os.path.join(SITE, "images", "projects", slug)
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest)

    images = []
    for i, f in enumerate(files, 1):
        out = copy_photo(os.path.join(src, f), os.path.join(dest, f"{i:02d}"))
        if not out:
            continue
        rel = os.path.relpath(out, SITE).replace(os.sep, "/")
        images.append({"src": rel, "alt": f"{a.title}, photo {i}", "caption": ""})
        print("  +", rel)
    if not images:
        sys.exit("No photos could be copied.")

    plans = []
    if a.plans:
        psrc = os.path.abspath(os.path.expanduser(a.plans))
        if not os.path.isdir(psrc):
            sys.exit(f"Plans folder not found: {psrc}")
        pfiles = sorted([f for f in os.listdir(psrc) if f.endswith(PLAN_EXT) and not f.startswith(".")], key=natural_key)
        skipped = [f for f in os.listdir(psrc) if f.lower().endswith(".pdf")]
        if skipped:
            print("  ! PDFs are not shown on the site. Export them to JPG/PNG first:", ", ".join(skipped))
        if pfiles:
            os.makedirs(os.path.join(dest, "plans"), exist_ok=True)
        for i, f in enumerate(pfiles, 1):
            out = copy_photo(os.path.join(psrc, f), os.path.join(dest, "plans", f"plan-{i:02d}"), max_px=2800)
            if not out:
                continue
            rel = os.path.relpath(out, SITE).replace(os.sep, "/")
            plans.append({"src": rel, "alt": f"{a.title}, floor plan {i}", "caption": os.path.splitext(f)[0].replace("_", " ").replace("-", " ")})
            print("  + plan", rel)

    split = lambda s: [x.strip() for x in s.split(",") if x.strip()]
    cover = images[min(max(a.cover, 1), len(images)) - 1]["src"]
    entry = {
        "slug": slug,
        "title": a.title,
        "neighborhood": a.neighborhood,
        "year": str(a.year),
        "categories": split(a.categories) or ["Full Home"],
        "scope": split(a.scope),
        "summary": a.summary,
        "description": a.description,
        "cover": cover,
        "images": images,
    }
    if plans:
        entry["plans"] = plans
    projects.insert(0, entry)
    save(d)
    print(f"\nAdded '{a.title}' with {len(images)} photos and {len(plans)} plans -> images/projects/{slug}/")
    print("Edit captions or text any time in data/projects.json.")

if __name__ == "__main__":
    main()
