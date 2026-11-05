"""Generate the illustrated panel preview used by the README and storefront.

Everything is drawn from code: no account data, no screenshots, deterministic
output. The footer note inside the image marks it as an illustration with
example data.

Usage (from the repository root):

    python tools/make-preview.py

Requires Pillow (`pip install pillow`). Windows with Segoe UI installed gives
the closest match to the DeepSeek Harness UI; other platforms fall back to
Pillow's default font.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

S = 2  # supersample factor
W, H = 1600, 1100
CANVAS_W, CANVAS_H = W * S, H * S

BG = (30, 30, 30, 255)
CARD = (38, 38, 38, 255)
BORDER = (58, 58, 58, 255)
TEXT = (237, 237, 237, 255)
MUTED = (163, 163, 163, 255)
FAINT = (120, 120, 120, 255)
ACCENT = (77, 107, 254, 255)
GREEN = (63, 185, 80, 255)
RED = (248, 81, 73, 255)

FONT_DIR = Path(r"C:\Windows\Fonts")


def font(candidates, size):
    for name in candidates:
        path = FONT_DIR / name
        if path.exists():
            return ImageFont.truetype(str(path), size * S)
    try:
        return ImageFont.load_default(size=size * S)
    except TypeError:
        return ImageFont.load_default()


F_REG = font(["segoeui.ttf", "arial.ttf"], 16)
F_REG_S = font(["segoeui.ttf", "arial.ttf"], 15)
F_SEMI = font(["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"], 18)
F_BOLD = font(["segoeuib.ttf", "arialbd.ttf"], 22)
F_TITLE = font(["segoeuib.ttf", "arialbd.ttf"], 34)
F_BIG = font(["segoeuib.ttf", "arialbd.ttf"], 30)
F_LABEL = font(["segoeui.ttf", "arial.ttf"], 15)
F_TINY = font(["segoeui.ttf", "arial.ttf"], 13)

img = Image.new("RGBA", (CANVAS_W, CANVAS_H), BG)
d = ImageDraw.Draw(img)


def sc(v):
    return int(round(v * S))


def rr(box, radius=14, fill=CARD, outline=BORDER, width=1):
    d.rounded_rectangle([sc(box[0]), sc(box[1]), sc(box[2]), sc(box[3])],
                        radius=sc(radius), fill=fill, outline=outline, width=sc(width))


def text(xy, s, f, color=TEXT, anchor="la"):
    d.text((sc(xy[0]), sc(xy[1])), s, font=f, fill=color, anchor=anchor)


def circle(cx, cy, r, fill=None, outline=None, width=1):
    d.ellipse([sc(cx - r), sc(cy - r), sc(cx + r), sc(cy + r)], fill=fill, outline=outline, width=sc(width))


def line(a, b, color=TEXT, width=2):
    d.line([sc(a[0]), sc(a[1]), sc(b[0]), sc(b[1])], fill=color, width=sc(width))


def check(cx, cy, color=GREEN):
    line((cx - 5, cy), (cx - 1, cy + 4), color, 2)
    line((cx - 1, cy + 4), (cx + 6, cy - 5), color, 2)


# ------------------------------------------------------------------ header
text((48, 40), "GitHub", F_TITLE, TEXT)
text((48, 92), "Connect once, then manage your repositories, profile and clean-up tasks from this page.", F_REG, MUTED)
text((48, 114), "Nothing here asks for a token — it uses the GitHub CLI you are already signed in with.", F_REG, MUTED)

# ------------------------------------------------------------------ connection card
rr((48, 156, 1552, 340))
circle(76, 188, 5, fill=GREEN)
text((92, 177), "Connected", F_SEMI, TEXT)
circle(100, 236, 24, fill=(60, 60, 60, 255))
text((100, 236), "Z", F_BOLD, MUTED, anchor="mm")
text((138, 214), "Connected as @octocat", F_SEMI, TEXT)
text((138, 242), "via GitHub CLI on this PC · 2.95.0", F_REG_S, MUTED)
text((138, 264), "Access: gist, read:org, repo", F_REG_S, MUTED)

# buttons (right side)
bx = 1064
rr((bx, 200, bx + 104, 240), 8, fill=(38, 38, 38, 255))
text((bx + 52, 220), "Re-check", F_REG_S, TEXT, anchor="mm")
rr((bx + 116, 200, bx + 232, 240), 8, fill=(38, 38, 38, 255), outline=RED)
text((bx + 174, 220), "Disconnect", F_REG_S, TEXT, anchor="mm")
text((bx + 250, 220), "Open profile", F_SEMI, TEXT, anchor="lm")

# ------------------------------------------------------------------ stats row
stats = [("Repositories", "12"), ("Public", "8"), ("Private", "4"), ("Archived", "2")]
x = 48
for label, value in stats:
    rr((x, 364, x + 232, 444), 12)
    text((x + 20, 378), label, F_LABEL, MUTED)
    text((x + 20, 400), value, F_BIG, TEXT)
    x += 246
for label in ("Descriptions", "Topics"):
    rr((x, 364, x + 232, 444), 12)
    text((x + 20, 378), label, F_LABEL, MUTED)
    check(x + 32, 418)
    x += 246

# ------------------------------------------------------------------ needs attention
rr((48, 468, 1552, 660))
text((72, 486), "Needs attention", F_BOLD, TEXT)
line((72, 526), (1528, 526), (58, 58, 58, 255), 1)

items = [
    ("2 repositories are missing topics.", "Review repositories"),
    ("Your profile bio is empty.", "Open profile settings"),
]
y = 548
for msg, action in items:
    circle(80, y + 9, 4, fill=MUTED)
    text((96, y), msg, F_REG, TEXT)
    text((1528, y + 1), action, F_REG_S, ACCENT, anchor="ra")
    y += 46

# ------------------------------------------------------------------ repositories
rr((48, 684, 1552, 1040))
text((72, 702), "Repositories", F_BOLD, TEXT)
text((1528, 706), "12 repositories", F_REG_S, MUTED, anchor="ra")

# search field
rr((72, 740, 1030, 784), 8, fill=(30, 30, 30, 255))
text((90, 761), "Search repositories...", F_REG_S, FAINT, anchor="lm")

# filter chips (right-aligned so nothing overflows)
chips = ["All", "Needs attention", "Public", "Private", "Archived"]
chip_pad = 14
chip_gap = 12
chip_widths = [int(d.textlength(chip, font=F_REG_S) / S) + chip_pad * 2 for chip in chips]
cx = 1528 - (sum(chip_widths) + chip_gap * (len(chips) - 1))
for i, chip in enumerate(chips):
    w = chip_widths[i]
    if i == 0:
        rr((cx, 742, cx + w, 782), 8, fill=TEXT, outline=TEXT)
        text((cx + w / 2, 762), chip, F_REG_S, (30, 30, 30, 255), anchor="mm")
    else:
        rr((cx, 742, cx + w, 782), 8, fill=CARD, outline=CARD)
        text((cx + w / 2, 762), chip, F_REG_S, MUTED, anchor="mm")
    cx += w + chip_gap

# demo rows
rows = [("acme/website", "Public"), ("acme/api-server", "Public"), ("acme/design-system", "Private")]
y = 806
for name, badge in rows:
    line((72, y + 56), (1528, y + 56), (52, 52, 52, 255), 1)
    text((72, y), name, F_SEMI, TEXT)
    name_width = d.textlength(name, font=F_SEMI) / S
    bx2 = 72 + name_width + 16
    bw = int(d.textlength(badge, font=F_TINY) / S) + 24
    rr((bx2, y + 6, bx2 + bw, y + 30), 6, fill=CARD, outline=(70, 70, 70, 255))
    text((bx2 + bw / 2, y + 18), badge, F_TINY, MUTED, anchor="mm")
    for j, act in enumerate(["Edit", "Rename", "Archive", "Open on GitHub"]):
        text((1100 + j * 112, y + 6), act, F_REG_S, TEXT if act == "Open on GitHub" else MUTED)
    y += 74

# honesty note
text((1528, 1060), "Illustration with example data", F_TINY, FAINT, anchor="ra")

out = img.resize((W, H), Image.LANCZOS)
target = Path(__file__).resolve().parents[1] / "assets" / "preview.png"
target.parent.mkdir(parents=True, exist_ok=True)
out.save(target)
print("wrote", target, out.size)
