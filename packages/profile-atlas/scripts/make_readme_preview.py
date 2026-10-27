"""Build an illustrated looping GIF of the live gallery and activity timeline.

Run `python scripts/make_readme_preview.py` in the Site checkout.
This is a design-accurate illustration using actual public project screenshots,
not a direct browser recording.
"""
from pathlib import Path
from math import cos, sin, pi
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist' / 'assets' if (ROOT / 'dist' / 'assets').exists() else ROOT / 'assets'
OUT = ASSETS / 'profile-atlas-preview.gif'
W, H = 960, 456
BG, PANEL, INK, MUTED, EDGE = '#f5f3ec', '#f9f8f3', '#282b25', '#8e8e83', '#d6d3c8'
SERIF = ['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 'C:/Windows/Fonts/georgia.ttf', '/System/Library/Fonts/Supplemental/Georgia.ttf', 'DejaVuSerif.ttf']
SANS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:/Windows/Fonts/arial.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf', 'DejaVuSans.ttf']


def system_font(size, serif=False):
    for path in SERIF if serif else SANS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


font = {name: system_font(size, serif) for name, size, serif in (
    ('brand', 11, False), ('tiny', 10, False), ('small', 12, False),
    ('title', 29, True), ('card', 15, True), ('number', 25, True))}
projects = [
    ('ViBo', 'vibo.webp', '#c5dfcd'), ('Sumzup', 'sumzup.webp', '#d6d4ca'),
    ('Consilium', None, '#bad0c2'), ('SSMT', None, '#c5ded3'),
    ('Paper UI', 'paper-ui.webp', '#e9e2d5'),
    ('Shorts Remover', 'shorts-remover.webp', '#e5ddd9'),
    ('YouTube to Text', None, '#ddd2e4'),
]
photos = {}
for name, filename, _ in projects:
    if filename:
        with Image.open(ASSETS / 'project-previews' / filename) as source:
            photos[name] = ImageOps.fit(source.convert('RGBA'), (160, 172), method=Image.Resampling.LANCZOS, centering=(0.5, 0.25))


def page(title, subtitle):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.ellipse((36, 22, 64, 50), fill='#565e53')
    d.text((50, 36), 'A', fill='white', font=font['card'], anchor='mm')
    d.text((73, 35), 'PROFILE ATLAS', fill=INK, font=font['brand'], anchor='lm')
    d.text((922, 35), 'OPEN SOURCE / WEB COMPONENTS', fill=MUTED, font=font['tiny'], anchor='rm')
    d.line((35, 64, 925, 64), fill=EDGE)
    d.text((38, 91), title, fill=INK, font=font['title'])
    d.text((921, 103), subtitle, fill=MUTED, font=font['small'], anchor='rm')
    d.rounded_rectangle((38, 140, 922, 425), radius=4, fill=PANEL, outline=EDGE)
    return im, d


def card(name, color, selected):
    w, h = 161, 237
    im = Image.new('RGBA', (w + 14, h + 16))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8, 11, w + 5, h + 13), radius=7, fill='#33352c26')
    d.rounded_rectangle((1, 1, w - 1, h - 1), radius=7, fill='#fcfaf5', outline='#bab6aa' if selected else '#cecbbe', width=2 if selected else 1)
    if name in photos:
        im.paste(photos[name], (1, 1), photos[name])
    else:
        d.rectangle((2, 2, w - 2, 173), fill=color)
        initials = ''.join(word[0] for word in name.split()[:2]).upper()
        d.text((w / 2, 87), initials, font=font['title'], fill='#6d776a', anchor='mm')
    d.rectangle((2, 172, w - 2, h - 2), fill='#fcfaf5')
    label = name
    while d.textbbox((0, 0), label, font=font['card'])[2] > w - 18:
        label = label[:-2] + '…'
    d.text((11, 184), label, fill=INK, font=font['card'])
    d.text((11, 214), 'VIEW  ↗', fill='#827361', font=font['tiny'])
    return im


def gallery(active=None):
    im, d = page('Projects', 'Made     Saved     Remixed          Browse all ↗')
    d.text((60, 152), "THINGS I'VE BUILT", fill=MUTED, font=font['tiny'])
    for index, (name, _, color) in enumerate(projects):
        if active == index:
            continue
        p = card(name, color, False)
        im.paste(p, (88 + index * 111, 171), p)
    if active is not None:
        name, _, color = projects[active]
        p = card(name, color, True)
        im.paste(p, (86 + active * 111, 150), p)
    d = ImageDraw.Draw(im)
    d.text((480, 412), projects[active][0] if active is not None else 'Select a card to explore', font=font['small'], fill=MUTED, anchor='mm')
    return im


def branch(d, x, y, color):
    origin_x = x - 24 if y < 271 else x + 24
    # A gentle cubic spline leaves the shared timeline and reaches the event.
    points = []
    for k in range(25):
        t = k / 24
        points.append(((1-t)**3 * origin_x + (1 - (1-t)**3) * x,
                       (1-t)**3 * 271 + 3*(1-t)*t*t * y + t**3*y + 3*(1-t)*(1-t)*t*271))
    d.line(points, fill=color, width=2, joint='curve')


def icon(d, x, y, kind, selected=False):
    color = {'star': '#998158', 'fork': '#7e8099', 'project': '#b08474', 'commit': '#72917e'}[kind]
    r = 18 if selected else 16
    d.ellipse((x-r, y-r, x+r, y+r), fill='#fffcf5', outline=color, width=2 if selected else 1)
    if kind == 'star':
        pts = [(x + (10 if k%2==0 else 5)*cos(-pi/2+k*pi/5), y + (10 if k%2==0 else 5)*sin(-pi/2+k*pi/5)) for k in range(10)]
        d.polygon(pts, outline=color)
    elif kind == 'fork':
        d.line((x-7,y-7,x-7,y,x,y+6,x+7,y,x+7,y-7), fill=color, width=2, joint='curve')
        for px,py in ((x-7,y-7),(x+7,y-7),(x,y+8)):
            d.ellipse((px-2,py-2,px+2,py+2), fill=PANEL, outline=color)
    elif kind == 'project':
        d.rectangle((x-7,y-9,x+7,y+9), outline=color, width=2)
        d.line((x-4,y,x+4,y), fill=color, width=2)
        d.line((x,y-4,x,y+4), fill=color, width=2)
    else:
        d.line((x,y-9,x,y+6), fill=color, width=2)
        d.line((x-5,y-4,x,y-9,x+5,y-4), fill=color, width=2)
        d.line((x-8,y+8,x+8,y+8), fill=color, width=2)


def timeline(selected=0):
    im, d = page('GitHub activity', '☆ Star      ⑂ Fork      ⊞ New repo      ↥ Push')
    d.text((60, 157), '2026', fill=MUTED, font=font['tiny'])
    d.line((68, 271, 892, 271), fill='#94978e', width=2)
    d.line((884, 265, 892, 271, 884, 277), fill='#94978e', width=2)
    events = [(125,208,'star'),(222,234,'fork'),(291,331,'project'),
              (401,198,'star'),(485,331,'project'),(572,234,'fork'),
              (664,208,'star'),(748,331,'project'),(836,234,'fork'),(884,329,'commit')]
    colors = {'star':'#d8c8ac','fork':'#cecddb','project':'#e1c5b8','commit':'#c5d9cd'}
    for k,(x,y,kind) in enumerate(events):
        branch(d,x,y + (16 if y<271 else -16),colors[kind])
        icon(d,x,y,kind,k==selected%len(events))
    d.line((60,357,901,357), fill=EDGE)
    d.text((62,372),'MONTHLY ANALYSIS',font=font['tiny'],fill=MUTED)
    d.text((892,372),'OCT 2026',font=font['tiny'],fill=MUTED,anchor='ra')
    for i,(label,value) in enumerate((('Star',24),('Fork',6),('New repo',3),('Push',28))):
        x = 270+i*166
        d.text((x,382),label,fill=MUTED,font=font['tiny'])
        d.text((x,395),str(value),fill=INK,font=font['number'])
    return im


def main():
    initial = gallery()
    frames = [initial]*3 + [gallery(0)]*5 + [gallery(4)]*6
    panels = [timeline(i) for i in range(9)]
    frames += [Image.blend(frames[-1],panels[0],a/5) for a in (1,2,3,4,5)]
    frames += panels + [panels[-1]]*2
    frames += [Image.blend(panels[-1],initial,a/5) for a in (1,2,3,4,5)]
    palette = [im.quantize(colors=96, method=Image.Quantize.FASTOCTREE) for im in frames]
    palette[0].save(OUT,format='GIF',save_all=True,append_images=palette[1:],duration=125,loop=0,optimize=True,disposal=2)
    print(f'{OUT}: {OUT.stat().st_size:,} bytes, {len(frames)} frames')


if __name__ == '__main__':
    main()
