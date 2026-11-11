#!/usr/bin/env python3
"""Author a measured ground-floor plan (SVG) and an HTML wrapper for rasterizing."""
from __future__ import annotations

from pathlib import Path

W, H = 1152, 864
OX, OY = 118.0, 148.0
S = 14.25  # px per foot
EXT = 0.50
IW = 0.40
PAPER = "#f4ead8"

# Rooms (feet, origin = interior NW corner, +y south)
# Kitchen 16x22 (0-16), Dining 20x22 (16-36), Entry 12x22 (36-48),
# Powder 5x8 in NE of entry (43-48, 0-8), Living 16x22 (48-64),
# Porch 8' south of the house (y=22-30).


def px(x: float, y: float) -> tuple[float, float]:
    return OX + x * S, OY + y * S


def fxy(x: float, y: float, w: float, h: float) -> tuple[float, float, float, float]:
    X, Y = px(x, y)
    return X, Y, w * S, h * S


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class Plan:
    def __init__(self) -> None:
        self.parts: list[str] = []

    def add(self, s: str) -> None:
        self.parts.append(s)

    def rect(self, x, y, w, h, class_=None, **kw) -> None:
        X, Y, ww, hh = fxy(x, y, w, h)
        self.rect_px(X, Y, ww, hh, class_=class_, **kw)

    def rect_px(self, X, Y, w, h, class_=None, **kw) -> None:
        attrs = [f'x="{X:.2f}"', f'y="{Y:.2f}"', f'width="{w:.2f}"', f'height="{h:.2f}"']
        if class_:
            attrs.append(f'class="{class_}"')
        for k, v in kw.items():
            name = k[:-1] if k.endswith("_") and k != k.rstrip("_") else k.replace("_", "-")
            # class_ already handled; other trailing-underscore python names
            if k.endswith("_") and not k.startswith("data"):
                name = k[:-1].replace("_", "-")
            attrs.append(f'{name}="{v}"')
        self.add(f'    <rect {" ".join(attrs)}/>')

    def line_px(self, x1, y1, x2, y2, class_="dim") -> None:
        self.add(
            f'    <line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" class="{class_}"/>'
        )

    def line(self, x1, y1, x2, y2, class_="dim") -> None:
        X1, Y1 = px(x1, y1)
        X2, Y2 = px(x2, y2)
        self.line_px(X1, Y1, X2, Y2, class_=class_)

    def circle(self, x, y, r, class_=None, r_px=None, **kw) -> None:
        X, Y = px(x, y)
        rr = r * S if r_px is None else r_px
        attrs = [f'cx="{X:.2f}"', f'cy="{Y:.2f}"', f'r="{rr:.2f}"']
        if class_:
            attrs.append(f'class="{class_}"')
        for k, v in kw.items():
            name = k[:-1] if k.endswith("_") else k.replace("_", "-")
            attrs.append(f'{name}="{v}"')
        self.add(f'    <circle {" ".join(attrs)}/>')

    def text(self, x, y, s, class_="dt", anchor="middle", rotate=None, px_mode=False) -> None:
        if px_mode:
            X, Y = x, y
        else:
            X, Y = px(x, y)
        extra = f' transform="rotate({rotate} {X:.2f} {Y:.2f})"' if rotate is not None else ""
        self.add(
            f'    <text x="{X:.2f}" y="{Y:.2f}" class="{class_}" text-anchor="{anchor}"{extra}>{esc(s)}</text>'
        )

    def path(self, d: str, class_="door") -> None:
        self.add(f'    <path d="{d}" class="{class_}"/>')

    def comment(self, s: str) -> None:
        self.add(f"    <!-- {s} -->")

    # --- walls: filled strips with gaps for openings ---
    def wall_h(self, x0, x1, y, thick, class_="ew", openings=None) -> None:
        """Horizontal wall. y is the centerline in feet. openings: list of (start, end) along x."""
        openings = sorted(openings or [])
        # merge
        segs = []
        cursor = x0
        for a, b in openings:
            a, b = max(a, x0), min(b, x1)
            if b <= cursor:
                continue
            if a > cursor:
                segs.append((cursor, a))
            cursor = max(cursor, b)
        if cursor < x1:
            segs.append((cursor, x1))
        for a, b in segs:
            self.rect(a, y - thick / 2, b - a, thick, class_=class_)

    def wall_v(self, y0, y1, x, thick, class_="ew", openings=None) -> None:
        openings = sorted(openings or [])
        segs = []
        cursor = y0
        for a, b in openings:
            a, b = max(a, y0), min(b, y1)
            if b <= cursor:
                continue
            if a > cursor:
                segs.append((cursor, a))
            cursor = max(cursor, b)
        if cursor < y1:
            segs.append((cursor, y1))
        for a, b in segs:
            self.rect(x - thick / 2, a, thick, b - a, class_=class_)

    def window_h(self, x0, x1, y, thick) -> None:
        """Three thin lines through a horizontal wall opening."""
        X0, Yc = px(x0, y)
        X1, _ = px(x1, y)
        t = thick * S
        for dy in (-t * 0.28, 0.0, t * 0.28):
            self.line_px(X0, Yc + dy, X1, Yc + dy, class_="win")

    def window_v(self, y0, y1, x, thick) -> None:
        _, Y0 = px(x, y0)
        Xc, Y1 = px(x, y1)
        t = thick * S
        for dx in (-t * 0.28, 0.0, t * 0.28):
            self.line_px(Xc + dx, Y0, Xc + dx, Y1, class_="win")

    def door_swing_in_h_wall(self, hinge_x, y, width, swing_south, hinge_on_plus_x) -> None:
        """Door in a horizontal wall. Leaf drawn closed (along the wall), arc into the room.
        swing_south: True if the door swings toward +y (south).
        hinge_on_plus_x: True if the hinge is at hinge_x and the leaf extends toward +x when closed.
        width is the leaf length in feet.
        """
        # Closed leaf along the wall
        leaf_dir = 1 if hinge_on_plus_x else -1
        x_end = hinge_x + leaf_dir * width
        self.line(hinge_x, y, x_end, y, class_="door")
        # Arc from closed end to open end (open is perpendicular into the room)
        Hx, Hy = px(hinge_x, y)
        Ex, Ey = px(x_end, y)
        r = width * S
        open_y = y + (width if swing_south else -width)
        Ox, Oy = px(hinge_x, open_y)
        # Sweep: from closed end to open end. SVG sweep-flag 1 = clockwise.
        # If hinge_on_plus_x and swing_south: closed is east, open is south → clockwise.
        # If hinge_on_plus_x and not swing_south: closed east, open north → CCW.
        # If not hinge_on_plus_x and swing_south: closed west, open south → CCW.
        # If not hinge_on_plus_x and not swing_south: closed west, open north → CW.
        cw = (hinge_on_plus_x and swing_south) or ((not hinge_on_plus_x) and (not swing_south))
        sweep = 1 if cw else 0
        self.path(f"M {Ex:.2f} {Ey:.2f} A {r:.2f} {r:.2f} 0 0 {sweep} {Ox:.2f} {Oy:.2f}", class_="door")

    def door_swing_in_v_wall(self, hinge_y, x, width, swing_east, hinge_on_plus_y) -> None:
        """Door in a vertical wall. Leaf closed along the wall, arc into the room."""
        leaf_dir = 1 if hinge_on_plus_y else -1
        y_end = hinge_y + leaf_dir * width
        self.line(x, hinge_y, x, y_end, class_="door")
        Hx, Hy = px(x, hinge_y)
        Ex, Ey = px(x, y_end)
        r = width * S
        open_x = x + (width if swing_east else -width)
        Ox, Oy = px(open_x, hinge_y)
        # hinge_on_plus_y and swing_east: closed south, open east → CCW
        # hinge_on_plus_y and not swing_east: closed south, open west → CW
        # not hinge_on_plus_y and swing_east: closed north, open east → CW
        # not hinge_on_plus_y and not swing_east: closed north, open west → CCW
        cw = (hinge_on_plus_y and (not swing_east)) or ((not hinge_on_plus_y) and swing_east)
        sweep = 1 if cw else 0
        self.path(f"M {Ex:.2f} {Ey:.2f} A {r:.2f} {r:.2f} 0 0 {sweep} {Ox:.2f} {Oy:.2f}", class_="door")

    def range_unit(self, x, y, w, h, horizontal=True) -> None:
        self.rect(x, y, w, h, class_="range")
        # Four clearly separated burners, inset from the cooktop edge.
        rad = 0.20
        ix, iy = min(0.42, w * 0.28), min(0.42, h * 0.28)
        xs = [x + ix, x + w - ix]
        ys = [y + iy, y + h - iy]
        for cx in xs:
            for cy in ys:
                self.circle(cx, cy, rad, class_="furns")

    def sink_unit(self, x, y, w, h, faucet_dir: str) -> None:
        """Double-bowl sink with a faucet toward the wall. faucet_dir in n,s,e,w."""
        self.rect(x, y, w, h, class_="sink", rx="1")
        # divider
        if w >= h:
            mid = x + w / 2
            self.line(mid, y + 0.12, mid, y + h - 0.12, class_="sink")
            bowls = [(x + w * 0.25, y + h / 2), (x + w * 0.75, y + h / 2)]
        else:
            mid = y + h / 2
            self.line(x + 0.12, mid, x + w - 0.12, mid, class_="sink")
            bowls = [(x + w / 2, y + h * 0.25), (x + w / 2, y + h * 0.75)]
        # tiny bowl ticks already via divider; faucet
        if faucet_dir == "n":
            fx, fy = x + w / 2, y
            self.line(fx, fy, fx, fy - 0.18, class_="sink")
            self.line(fx - 0.16, fy - 0.18, fx + 0.16, fy - 0.18, class_="sink")
        elif faucet_dir == "s":
            fx, fy = x + w / 2, y + h
            self.line(fx, fy, fx, fy + 0.18, class_="sink")
            self.line(fx - 0.16, fy + 0.18, fx + 0.16, fy + 0.18, class_="sink")
        elif faucet_dir == "w":
            fx, fy = x, y + h / 2
            self.line(fx, fy, fx - 0.18, fy, class_="sink")
            self.line(fx - 0.18, fy - 0.16, fx - 0.18, fy + 0.16, class_="sink")
        else:  # e
            fx, fy = x + w, y + h / 2
            self.line(fx, fy, fx + 0.18, fy, class_="sink")
            self.line(fx + 0.18, fy - 0.16, fx + 0.18, fy + 0.16, class_="sink")

    def dim_h(self, x0, x1, y_ft, label, y_px=None) -> None:
        Y = y_px if y_px is not None else (OY + y_ft * S)
        X0, _ = px(x0, 0)
        X1, _ = px(x1, 0)
        self.line_px(X0, Y, X1, Y, class_="dim")
        tick = 6
        self.line_px(X0, Y - tick, X0, Y + tick, class_="dim")
        self.line_px(X1, Y - tick, X1, Y + tick, class_="dim")
        self.text((X0 + X1) / 2, Y - 8, label, class_="dt", anchor="middle", px_mode=True)

    def dim_v(self, y0, y1, x_ft, label, x_px=None) -> None:
        X = x_px if x_px is not None else (OX + x_ft * S)
        _, Y0 = px(0, y0)
        _, Y1 = px(0, y1)
        self.line_px(X, Y0, X, Y1, class_="dim")
        tick = 6
        self.line_px(X - tick, Y0, X + tick, Y0, class_="dim")
        self.line_px(X - tick, Y1, X + tick, Y1, class_="dim")
        self.text(X + 10, (Y0 + Y1) / 2, label, class_="dt", anchor="middle", rotate=90, px_mode=True)


def build() -> str:
    p = Plan()
    p.add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    p.add("""  <defs>
    <filter id="paper" x="-2%" y="-2%" width="104%" height="104%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.92  0 0 0 0 0.86  0 0 0 0 0.74  0 0 0 0.18 0" result="t"/>
      <feBlend in="SourceGraphic" in2="t" mode="multiply"/>
    </filter>
    <style>
    .ew { fill:#2b2b2b; }
    .iw { fill:#2b2b2b; }
    .win { fill:none; stroke:#2b2b2b; stroke-width:1.05; stroke-linecap:square; }
    .door { fill:none; stroke:#2b2b2b; stroke-width:1.15; stroke-linecap:round; stroke-linejoin:round; }
    .furn { fill:rgba(106,88,64,0.09); stroke:#2b2b2b; stroke-width:1.05; stroke-linejoin:round; }
    .furns { fill:none; stroke:#2b2b2b; stroke-width:1.05; }
    .island { fill:rgba(244,234,216,0.85); stroke:#2b2b2b; stroke-width:1.15; }
    .range { fill:rgba(43,43,43,0.16); stroke:#2b2b2b; stroke-width:1.05; }
    .sink { fill:none; stroke:#2b2b2b; stroke-width:1.05; }
    .dim { fill:none; stroke:#9a7b4f; stroke-width:1; stroke-linecap:square; }
    .rn { font:600 13px Jost, "Noto Sans", sans-serif; letter-spacing:2.4px; fill:#2b2b2b; }
    .rd { font:italic 18px "Cormorant Garamond", "EB Garamond", Georgia, serif; fill:#9a7b4f; }
    .dt { font:16px "Cormorant Garamond", "EB Garamond", Georgia, serif; fill:#9a7b4f; }
    .note { font:italic 15px "Cormorant Garamond", "EB Garamond", Georgia, serif; fill:#5a554f; }
    .zt { font:600 10px Jost, "Noto Sans", sans-serif; letter-spacing:1.8px; fill:#2b2b2b; }
    .title { font:600 15px Cinzel, "EB Garamond", serif; letter-spacing:4px; fill:#2b2b2b; }
    .sub { font:italic 15px "Cormorant Garamond", "EB Garamond", Georgia, serif; fill:#9a7b4f; }
    .foot { font:11px Jost, "Noto Sans", sans-serif; letter-spacing:2.2px; fill:#9a7b4f; }
    .n-c { fill:none; stroke:#9a7b4f; stroke-width:1.2; }
    .n-a { fill:#9a7b4f; }
    .col { fill:#efe4d0; stroke:#2b2b2b; stroke-width:1.05; }
    .step { fill:none; stroke:#2b2b2b; stroke-width:1.05; }
    .porch { fill:rgba(201,165,90,0.10); stroke:#9a7b4f; stroke-width:1.4; }
    .wash { fill:rgba(201,165,90,0.28); }
    .stair { fill:none; stroke:#2b2b2b; stroke-width:1.05; }
    .stair-fill { fill:rgba(244,234,216,0.5); stroke:#2b2b2b; stroke-width:1.05; }
    </style>
  </defs>""")
    p.add(f'  <rect x="0" y="0" width="{W}" height="{H}" fill="{PAPER}" filter="url(#paper)"/>')
    p.add("  <g id='plan'>")

    # Title
    p.text(576, 32, "GROUND FLOOR PLAN", class_="title", anchor="middle", px_mode=True)
    p.text(
        576,
        50,
        "Illustrative example  ·  64'-0\" × 22'-0\" plus an 8'-0\" front porch",
        class_="sub",
        anchor="middle",
        px_mode=True,
    )

    # Room washes (interior)
    p.rect(0, 0, 16, 22, class_="wash")  # kitchen
    p.rect(16, 0, 20, 22, class_="wash")  # dining
    p.rect(48, 0, 16, 22, class_="wash")  # living
    p.rect(-EXT, 22, 64 + 2 * EXT, 8 + EXT, class_="porch")  # porch

    # ---------------- Furniture (under walls so walls win) ----------------
    # Kitchen counters 2' deep
    # West meat run: from north wall to south, 2' deep, but fridge at north
    # Fridge 2.5 x 2.8 at NW
    p.rect(0.05, 0.55, 2.5, 2.8, class_="furn")  # fridge
    p.rect(0.0, 0.0, 2.0, 13.5, class_="furn")  # west counter (drawn first, fridge overlaps)
    # redraw fridge on top
    p.rect(0.05, 0.15, 2.5, 3.0, class_="furn")
    # meat sink (south of fridge) and range
    p.sink_unit(0.15, 3.5, 1.7, 1.8, "w")
    p.range_unit(0.10, 5.6, 1.85, 2.6, horizontal=False)
    p.text(1.0, 9.6, "MEAT", class_="zt", anchor="middle", rotate=-90)
    # south-end pantry cabinet on west wall
    p.rect(0.0, 16.0, 2.5, 3.0, class_="furn")

    # Dairy north run
    p.rect(2.5, 0.0, 12.3, 2.0, class_="furn")
    p.sink_unit(4.6, 0.15, 2.0, 1.7, "n")
    p.range_unit(7.2, 0.10, 2.6, 1.85, horizontal=True)
    p.text(11.2, 1.15, "DAIRY", class_="zt", anchor="middle")

    # Pareve island 7 x 3.5 at (5.0, 10.6) — keep axis-aligned, roughly centered
    ix, iy, iw, ih = 4.5, 9.1, 7.0, 3.5
    p.rect(ix, iy, iw, ih, class_="island")
    p.rect(ix + 0.15, iy + 0.15, iw - 0.3, ih - 0.3, class_="furns")
    p.text(ix + iw / 2, iy + ih / 2 + 0.15, "PAREVE", class_="zt", anchor="middle")

    # Dining table 12 x 4 at (20.0, 10.2), 6+6+1+1 chairs
    tx, ty, tw, th = 20.0, 9.15, 12.0, 4.0
    p.rect(tx, ty, tw, th, class_="furn", rx="2")
    chair = 1.40
    gap = (tw - 6 * chair) / 7
    for i in range(6):
        cx = tx + gap + i * (chair + gap)
        p.rect(cx, ty - 0.25 - chair, chair, chair, class_="furn", rx="4")  # north
        p.rect(cx, ty + th + 0.25, chair, chair, class_="furn", rx="4")  # south
    # end chairs
    p.rect(tx - 0.25 - chair, ty + (th - chair) / 2, chair, chair, class_="furn", rx="4")
    p.rect(tx + tw + 0.25, ty + (th - chair) / 2, chair, chair, class_="furn", rx="4")
    p.text(tx + tw / 2, ty - 2.15, "seats 14", class_="note", anchor="middle")
    # sideboard on dining north wall
    p.rect(22.5, 0.15, 8.0, 1.5, class_="furn")

    # Living: rug, east sofa, two west chairs, coffee table
    p.rect(50.5, 4.5, 12.0, 12.0, class_="furns")
    p.rect(50.5, 4.5, 12.0, 12.0, class_="furns", stroke_dasharray="4 3", fill_="rgba(154,123,79,0.08)")
    p.rect(61.2, 7.0, 2.8, 8.0, class_="furn", rx="3")  # sofa east
    p.rect(51.0, 7.0, 2.6, 2.6, class_="furn", rx="4")
    p.rect(51.0, 11.7, 2.6, 2.6, class_="furn", rx="4")
    p.rect(55.3, 9.5, 4.0, 2.4, class_="furn")

    # Powder fixtures: vanity on north wall, toilet on east wall (north half)
    p.rect(43.4, 0.2, 1.6, 1.4, class_="furn")  # vanity cabinet
    p.rect(43.55, 0.35, 1.2, 0.9, class_="sink", rx="1")  # basin
    # faucet north
    p.line(44.15, 0.35, 44.15, 0.18, class_="sink")
    p.line(44.0, 0.18, 44.3, 0.18, class_="sink")
    p.rect(46.05, 1.5, 1.5, 2.4, class_="furn", rx="3")  # toilet tank/bowl
    p.circle(46.8, 3.35, 0.55, class_="furns")

    # Stair: U-stair on west side of entry (x=36.4–42.4). Landing at north of the stair (y=8).
    # Two 3' flights, 10 treads each, going south from the landing.
    # West flight is UP going north toward the landing (start at south, near front).
    sx0, sxm, sx1 = 36.35, 39.35, 42.35
    land_y0, land_y1 = 8.0, 11.2
    stair_y1 = 20.2
    p.rect(sx0, land_y0, sx1 - sx0, land_y1 - land_y0, class_="stair-fill")  # landing
    p.rect(sx0, land_y1, 3.0, stair_y1 - land_y1, class_="stair-fill")
    p.rect(sxm, land_y1, 3.0, stair_y1 - land_y1, class_="stair-fill")
    n_treads = 10
    run = stair_y1 - land_y1
    for i in range(1, n_treads):
        yy = land_y1 + i * (run / n_treads)
        p.line(sx0, yy, sxm, yy, class_="stair")
        p.line(sxm, yy, sx1, yy, class_="stair")
    # center stringer
    p.line(sxm, land_y1, sxm, stair_y1, class_="stair")
    p.text(37.85, 15.7, "UP", class_="zt", anchor="middle")
    # arrow pointing north (toward landing / up)
    Ax, Ay = px(37.85, 17.5)
    p.path(f"M {Ax:.2f} {Ay:.2f} L {Ax:.2f} {Ay - 25.64:.2f}", class_="stair")
    p.path(
        f"M {Ax-5:.2f} {Ay-19.64:.2f} L {Ax:.2f} {Ay-25.64:.2f} L {Ax+5:.2f} {Ay-19.64:.2f}",
        class_="stair",
    )

    # ---------------- Walls & openings ----------------
    # Exterior: north y=0, south y=22, west x=0, east x=64. Thickness EXT, centered on line
    # (so half the wall sits outside the interior).
    # Windows (feet along the wall):
    # N: kitchen 5.3-9.3, powder 44.3-46.9, living 52-57.5
    # S: kitchen 3-7, dining 22.5-28.5, living 52-57.5
    # W: 5.5-9.7, 13-16.5
    # E: 4.5-9.5, 13.5-18.5
    # Doors / cased openings on exterior south: front door 3.5' centered at x=42 → 40.25-43.75

    # North exterior
    p.wall_h(
        0 - EXT / 2,
        64 + EXT / 2,
        0,
        EXT,
        class_="ew",
        openings=[(5.3, 9.3), (44.3, 46.9), (52.0, 57.5)],
    )
    p.window_h(5.3, 9.3, 0, EXT)
    p.window_h(44.3, 46.9, 0, EXT)
    p.window_h(52.0, 57.5, 0, EXT)

    # South exterior (front door opening)
    p.wall_h(
        0 - EXT / 2,
        64 + EXT / 2,
        22,
        EXT,
        class_="ew",
        openings=[(3.0, 7.0), (22.5, 28.5), (40.25, 43.75), (52.0, 57.5)],
    )
    p.window_h(3.0, 7.0, 22, EXT)
    p.window_h(22.5, 28.5, 22, EXT)
    p.window_h(52.0, 57.5, 22, EXT)

    # West exterior
    p.wall_v(0 - EXT / 2, 22 + EXT / 2, 0, EXT, class_="ew", openings=[(5.5, 9.7), (13.0, 16.5)])
    p.window_v(5.5, 9.7, 0, EXT)
    p.window_v(13.0, 16.5, 0, EXT)

    # East exterior
    p.wall_v(0 - EXT / 2, 22 + EXT / 2, 64, EXT, class_="ew", openings=[(4.5, 9.5), (13.5, 18.5)])
    p.window_v(4.5, 9.5, 64, EXT)
    p.window_v(13.5, 18.5, 64, EXT)

    # Interior: kitchen/dining at x=16, cased opening y=8-14
    p.wall_v(0, 22, 16, IW, class_="iw", openings=[(8.0, 14.0)])
    # Dining/entry at x=36, cased opening y=13-18.5 (east of dining into entry, south of landing)
    p.wall_v(0, 22, 36, IW, class_="iw", openings=[(13.0, 18.5)])
    # Entry/living at x=48, door 3' in the living, mid-southish: opening y=11.5-14.5
    p.wall_v(0, 22, 48, IW, class_="iw", openings=[(11.5, 14.5)])
    # Powder walls: west x=43, y=0-8, door 2.5' near south: opening y=5.3-7.8
    p.wall_v(0, 8, 43, IW, class_="iw", openings=[(5.3, 7.8)])
    # Powder south wall y=8, x=43-48, solid
    p.wall_h(43, 48, 8, IW, class_="iw")

    # Doors
    # Front door: in south wall y=22, 3.5' wide, hinge on the east (x=43.75), leaf extends west,
    # swings in (north, not south).
    p.door_swing_in_h_wall(hinge_x=43.75, y=22, width=3.5, swing_south=False, hinge_on_plus_x=False)
    # Living door: in v wall x=48, opening 11.5-14.5, hinge at north of opening (11.5),
    # leaf extends south, swings east into living.
    p.door_swing_in_v_wall(hinge_y=11.5, x=48, width=3.0, swing_east=True, hinge_on_plus_y=True)
    # Powder door: in v wall x=43, opening 5.3-7.8 (2.5'), hinge at north of opening (5.3),
    # leaf extends south, swings east into powder.
    p.door_swing_in_v_wall(hinge_y=5.3, x=43, width=2.5, swing_east=True, hinge_on_plus_y=True)

    # ---------------- Porch columns, steps ----------------
    # Piers 0.7' square, at house face (just south of south wall) and porch front (y=30)
    # Even rhythm, framing the steps at the door (x=40.25-43.75)
    pier = 0.70
    # house-face y: just south of exterior wall outer face (22+EXT/2 ≈ 22.25)
    y_house = 22 + EXT / 2 + 0.05
    y_front = 30 - pier
    xs = [0.0, 8.0, 16.0, 24.0, 32.0, 39.0, 45.0, 52.0, 58.0, 64.0 - pier]
    for xv in xs:
        p.rect(xv, y_house, pier, pier, class_="col")
        p.rect(xv, y_front, pier, pier, class_="col")

    # Three steps centered on the front door, projecting south of the porch
    step_w = 5.0
    step_x = 42.0 - step_w / 2
    for i, depth in enumerate((1.0, 2.0, 3.0)):
        p.rect(step_x - 0.1 * i, 30 + i * 0.7, step_w + 0.2 * i, 0.7, class_="step")

    # ---------------- Labels ----------------
    p.text(8.0, 17.5, "KITCHEN", class_="rn", anchor="middle")
    p.text(8.0, 18.85, "16'-0\" × 22'-0\"", class_="rd", anchor="middle")
    p.text(26.0, 18.1, "DINING", class_="rn", anchor="middle")
    p.text(26.0, 19.45, "20'-0\" × 22'-0\"", class_="rd", anchor="middle")
    p.text(39.5, 4.9, "ENTRY", class_="rn", anchor="middle")
    p.text(39.5, 6.25, "12'-0\" × 22'-0\"", class_="rd", anchor="middle")
    # Powder label OUTSIDE, just north of the powder (clear of door, fixtures, entry dim)
    p.text(45.5, -1.55, "POWDER", class_="rn", anchor="middle")
    p.text(45.5, -0.35, "5'-0\" × 8'-0\"", class_="rd", anchor="middle")
    p.text(56.0, 2.8, "LIVING", class_="rn", anchor="middle")
    p.text(56.0, 4.15, "16'-0\" × 22'-0\"", class_="rd", anchor="middle")
    p.text(8.5, 25.55, "FRONT PORCH", class_="rn", anchor="start")
    p.text(8.5, 27.05, "8'-0\" deep", class_="rd", anchor="start")

    # ---------------- Dimensions ----------------
    # Overall width below the porch + steps
    p.dim_h(0, 64, 0, "64'-0\"", y_px=OY + 30 * S + 56)
    # Room widths above north wall (leave room for powder label)
    p.dim_h(0, 16, 0, "16'-0\"", y_px=OY - 42)
    p.dim_h(16, 36, 0, "20'-0\"", y_px=OY - 42)
    p.dim_h(36, 48, 0, "12'-0\"", y_px=OY - 42)
    p.dim_h(48, 64, 0, "16'-0\"", y_px=OY - 42)
    # Depths to the east
    p.dim_v(0, 22, 0, "22'-0\"", x_px=OX + 64 * S + 36)
    p.dim_v(22, 30, 0, "8'-0\"", x_px=OX + 64 * S + 36)

    # North arrow (east of living, above north wall)
    nx, ny = 1000.0, 128.0
    p.add(f'    <circle cx="{nx:.2f}" cy="{ny:.2f}" r="16" class="n-c"/>')
    p.path(f"M {nx:.2f} {ny-16:.2f} L {nx+7:.2f} {ny+6:.2f} L {nx:.2f} {ny+2:.2f} L {nx-7:.2f} {ny+6:.2f} Z", class_="n-a")
    p.text(nx, ny + 24, "N", class_="dt", anchor="middle", px_mode=True)

    # Scale bar: 10 ft = 142.5 px, at lower left. Separate labels so spaces don't collapse.
    sx0, sy = 80.0, 770.0
    p.line_px(sx0, sy, sx0 + 10 * S, sy, class_="dim")
    for ft, lab in ((0, "0"), (5, "5"), (10, "10 ft")):
        x = sx0 + ft * S
        p.line_px(x, sy - 6, x, sy + 6, class_="dim")
        p.text(x, sy - 14, lab, class_="dt", anchor="middle", px_mode=True)
    # slightly thicker bar body
    p.rect_px(sx0, sy - 2, 5 * S, 4, class_="", fill_="#9a7b4f")

    # Footer
    p.text(
        576,
        840,
        "SAMPLE  ·  ILLUSTRATIVE EXAMPLE PLAN  ·  NOT A REAL CLIENT HOME",
        class_="foot",
        anchor="middle",
        px_mode=True,
    )
    p.text(
        576,
        856,
        "Meat and dairy each have a sink and a range  ·  pareve island  ·  dining table seats 14",
        class_="foot",
        anchor="middle",
        px_mode=True,
    )

    p.add("  </g>")
    p.add("</svg>")
    return "\n".join(p.parts) + "\n"


FONT_CSS = """
@font-face {
  font-family: "Jost";
  src: url("file:///usr/share/fonts/truetype/sand-box/google/Jost/Jost-VariableFont_wght.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}
@font-face {
  font-family: "Cinzel";
  src: url("file:///usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}
@font-face {
  font-family: "Cormorant Garamond";
  src: url("file:///usr/share/fonts/truetype/sand-box/google/Cormorant Garamond/CormorantGaramond-VariableFont_wght.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}
@font-face {
  font-family: "EB Garamond";
  src: url("file:///usr/share/fonts/truetype/sand-box/google/EB Garamond/EBGaramond-VariableFont_wght.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}
@font-face {
  font-family: "Cormorant Garamond";
  src: url("file:///usr/share/fonts/truetype/sand-box/google/Cormorant Garamond/CormorantGaramond-Italic-VariableFont_wght.ttf") format("truetype");
  font-weight: 100 900;
  font-style: italic;
}
"""


def write_outputs(svg: str, repo: Path) -> None:
    svg_path = repo / "images/concepts/ground-floor-plan.svg"
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    svg_path.write_text(svg)
    html = (
        "<!doctype html><html><head><meta charset=\"utf-8\"><style>"
        + FONT_CSS
        + "html,body{margin:0;padding:0;background:#f4ead8;}svg{display:block;}</style></head><body>\n"
        + svg
        + "</body></html>\n"
    )
    out = Path("/tmp/plan-render/plan.html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"wrote {svg_path} ({svg_path.stat().st_size} bytes)")
    print(f"wrote {out}")


if __name__ == "__main__":
    repo = Path(__file__).resolve().parents[1]
    write_outputs(build(), repo)
