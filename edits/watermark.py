#!/usr/bin/env python3
"""Apply the sgc.ks "glass" watermark to a video.

The letters are filled with the video itself, lightened 32% toward white,
with a 1px dark outline and a 1px emboss (light top-left, dark bottom-right).
Centered horizontally, bottom of the text 40px above the bottom edge of the
picture (auto-detected, so it stays inside the picture, not in black bars).
All sizes are for a 1080px-wide video and scale with the video width.

Usage:
    python3 watermark.py input.mp4 output.mp4 [--text sgc.ks] [--pic-bottom Y]

Needs: ffmpeg, numpy, pillow, and the Inter Display Black font
(falls back to DejaVu Sans Bold if Inter is missing).
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

# ---- the watermark spec (keep in sync with CLAUDE.md) ----
TEXT = 'sgc.ks'
FONT_SIZE = 24          # px at 1080 wide
TRACKING = 3            # px between letters at 1080 wide
LIFT = 0.32             # lighten inside letters: v + (255 - v) * LIFT
OUTLINE_A = 0.45        # 1px black outline opacity
HIGHLIGHT_A = 0.55      # top-left bevel (white) opacity
SHADOW_A = 0.45         # bottom-right bevel (black) opacity
MARGIN_BOTTOM = 40      # px from bottom of picture to bottom of text, at 1080 wide

FONTS = ['/usr/share/fonts/opentype/inter/InterDisplay-Black.otf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height', '-of', 'json', path],
                         stdout=subprocess.PIPE, check=True).stdout
    s = json.loads(out)['streams'][0]
    return s['width'], s['height']


def detect_picture_bottom(path, w, h):
    """Last row that isn't black bar, averaged over a few frames."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf',
                          'select=not(mod(n\\,30)),format=gray', '-fps_mode', 'passthrough',
                          '-frames:v', '12', '-f', 'rawvideo', '-'],
                         stdout=subprocess.PIPE, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    rows = fr.max(axis=0).mean(axis=1)
    lit = np.where(rows > 20)[0]
    return int(lit[-1]) + 1 if len(lit) else h


def build_layers(w, h, pic_bottom, text, tmp):
    k = w / 1080.0
    size, track, margin = round(FONT_SIZE * k), max(1, round(TRACKING * k)), round(MARGIN_BOTTOM * k)
    font = next((ImageFont.truetype(f, size) for f in FONTS if os.path.exists(f)), None)
    if font is None:
        sys.exit('no usable font found')
    ws = [font.getbbox(c)[2] - font.getbbox(c)[0] for c in text]
    bb = font.getbbox(text)
    tw, th = sum(ws) + track * (len(text) - 1), bb[3] - bb[1]
    x, y0 = (w - tw) // 2, pic_bottom - th - margin
    mask = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mask)
    for c, cw in zip(text, ws):
        d.text((x - font.getbbox(c)[0], y0 - bb[1]), c, font=font, fill=255)
        x += cw + track
    blur = mask.filter(ImageFilter.GaussianBlur(0.9))
    hi = ImageChops.subtract(blur, ImageChops.offset(blur, 1, 1))
    sh = ImageChops.subtract(blur, ImageChops.offset(blur, -1, -1))
    ol = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(3)), mask)
    edges = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for color, a, op in [((0, 0, 0), ol, OUTLINE_A), ((255, 255, 255), hi, HIGHLIGHT_A), ((0, 0, 0), sh, SHADOW_A)]:
        layer = Image.new('RGBA', (w, h), color + (0,))
        layer.putalpha(a.point(lambda v, op=op: int(v * op)))
        edges = Image.alpha_composite(edges, layer)
    mp, ep = os.path.join(tmp, 'mask.png'), os.path.join(tmp, 'edges.png')
    mask.save(mp)
    edges.save(ep)
    return mp, ep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--text', default=TEXT)
    ap.add_argument('--pic-bottom', type=int, help='y of the bottom edge of the picture (auto if omitted)')
    a = ap.parse_args()
    w, h = probe(a.input)
    pb = a.pic_bottom or detect_picture_bottom(a.input, w, h)
    lut = f"val+(255-val)*{LIFT}"
    with tempfile.TemporaryDirectory() as tmp:
        mp, ep = build_layers(w, h, pb, a.text, tmp)
        subprocess.run([
            'ffmpeg', '-v', 'error', '-y', '-i', a.input, '-i', mp, '-i', ep,
            '-filter_complex',
            f"[0:v]split[base][lit];[lit]lutrgb=r='{lut}':g='{lut}':b='{lut}'[lit2];"
            "[1:v]format=gray[m];[lit2][m]alphamerge[txt];[base][txt]overlay=0:0[v1];"
            "[v1][2:v]overlay=0:0,format=yuv420p",
            '-map', '0:a?', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
            '-c:a', 'copy', '-movflags', '+faststart', a.output], check=True)
    print(f'watermarked -> {a.output} (picture bottom at y={pb})')


if __name__ == '__main__':
    main()
