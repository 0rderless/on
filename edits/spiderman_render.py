#!/usr/bin/env python3
"""Spider-Man beat edit renderer.

Cuts clips from two source edits (A, B) onto the beat grid of the song,
removes the watermark strip, grades, adds beat zoom-punches/flashes,
and renders 1080x1920 @ 60fps H.264 with the user's sound.
"""
import subprocess, sys, json, math
import numpy as np
import cv2

import os
# Working folder: needs src/A.mov, src/B.mov, audio/song.wav, work/{A,B}_pts.txt
SC = os.environ.get('EDIT_DIR', os.getcwd())
SRC = {'A': f'{SC}/src/A.mov', 'B': f'{SC}/src/B.mov'}
SONG = f'{SC}/audio/song.wav'

FPS = 60
OUT_W, OUT_H = 1080, 1920
SRC_W, SRC_H = 828, 804            # common crop size (removes B's bottom watermark strip)
CROP_Y = {'A': 26, 'B': 0}         # A: centre crop; B: keep top, drop bottom 32px (watermark)
CONT_W = OUT_W
CONT_H = int(round(SRC_H * OUT_W / SRC_W / 2) * 2)   # 1048
CONT_Y = (OUT_H - CONT_H) // 2

# ---- beat grid (song time, seconds) -------------------------------------
P = 0.7328                      # beat period (~81.9 BPM)
G0 = 5.5705                     # the drop
LEAD = 0.010                    # cut a hair before the transient
def G(k):
    return G0 + P * k - LEAD

S0 = 1.180                      # song time at edit frame 0 (first hit ~1.19)
END = G(16)                     # stop right before the next hit -> clean TikTok loop

# (start, end, src, src_in, speed, kind)
#   kind: 'intro' | 'hit' (main-beat cut) | 'half' (off-beat cut)
EDL = [
    # ---------------- intro: parking-lot story (A-F) ----------------
    (S0,     G(-5), 'B', 0.000, 1.0, 'intro'),   # A web-shooter check
    (G(-5),  G(-4), 'B', 1.800, 1.0, 'intro'),   # B wide, walking/turning
    (G(-4),  G(-3), 'B', 3.890, 1.0, 'intro'),   # C walks toward camera
    (G(-3),  G(-2), 'B', 4.665, None, 'intro', 5.200),  # D thief laughing (slow-mo)
    (G(-2),  G(-1), 'B', 5.230, 1.0, 'shush'),   # E SHUSH (music goes quiet)
    (G(-1),  G(0),  'B', 6.150, None, 'riser', 6.790),  # F thief webbed (riser)
    # ---------------- drop: K L W M ----------------
    (G(0),   G(0.5),'B', 7.390, 1.0, 'drop'),    # K crane, back view
    (G(0.5), G(1),  'B', 8.050, 1.0, 'half'),    # L crane, arms out
    (G(1),   G(2),  'B', 6.807, None, 'hit', 7.345),  # W moon (flash in, slow-mo)
    (G(2),   G(3.5),'B', 8.500, 1.0, 'hit'),     # M dive into blur (1.5 beats)
    # ---------------- H I J O Q T ----------------
    (G(3.5), G(5),  'A', 0.000, 1.0, 'half'),    # H electric swing past building (1.5 beats)
    (G(5),   G(6),  'A', 2.020, 1.0, 'hit'),     # I rooftop swing
    (G(6),   G(7),  'A', 2.800, 1.0, 'hit'),     # J landing, electric swirl
    (G(7),   G(7.5),'A', 9.215, 1.0, 'hit'),     # O falling w/ lightning
    (G(7.5), G(8),  'A', 8.295, 1.0, 'half'),    # Q electric hand
    (G(8),   G(8.5),'A', 10.595, 1.0, 'hit'),    # T pink mask
    # ---------------- G V N X Y Z ----------------
    (G(8.5), G(10), 'A', 5.020, 1.0, 'half'),    # G train surf (1.5 beats)
    (G(10),  G(11), 'A', 4.300, 1.0, 'hit'),     # V electric blast along building
    (G(11),  G(12), 'B', 9.745, None, 'hit', 10.205),  # N upside-down mask (slow-mo)
    (G(12),  G(13), 'A', 1.050, 1.0, 'hit'),     # X pink/blue whoosh swing
    (G(13),  G(13.5),'A', 6.120, 1.0, 'hit'),    # Y flying, blue sky
    (G(13.5),G(14), 'A', 3.840, 1.0, 'half'),    # Z leap off ledge
    # ---------------- end on P (2 beats) ----------------
    (G(14),  END,   'B', 10.240, None, 'final', 10.755),  # P bright crouch (slow-mo + push-in)
]

SAT = {'A': 1.10, 'B': 1.28}
CONTRAST = {'A': 1.03, 'B': 1.06}


def load_frames(name):
    pts = []
    for line in open(f'{SC}/work/{name}_pts.txt'):
        line = line.strip().strip(',')
        if line:
            pts.append(float(line))
    cmd = ['ffmpeg', '-v', 'error', '-i', SRC[name], '-fps_mode', 'passthrough',
           '-vf', f'crop={SRC_W}:{SRC_H}:0:{CROP_Y[name]},scale=in_color_matrix=bt709:in_range=pc:out_range=pc,format=bgr24',
           '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, SRC_H, SRC_W, 3)
    n = min(len(fr), len(pts))
    return fr[:n], np.array(pts[:n])


_dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
_flow_cache = {}

def flows(name, i, frames):
    key = (name, i)
    if key not in _flow_cache:
        a = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
        b = cv2.cvtColor(frames[i + 1], cv2.COLOR_BGR2GRAY)
        f01 = _dis.calc(a, b, None)
        f10 = _dis.calc(b, a, None)
        _flow_cache[key] = (f01, f10)
    return _flow_cache[key]

_gx, _gy = np.meshgrid(np.arange(SRC_W, dtype=np.float32), np.arange(SRC_H, dtype=np.float32))

def interp(name, frames, i, t):
    """Optical-flow interpolation between frames i and i+1 at fraction t."""
    if t < 0.02:
        return frames[i]
    if t > 0.98:
        return frames[i + 1]
    f01, f10 = flows(name, i, frames)
    ft0 = (-(1 - t) * t * f01 + t * t * f10).astype(np.float32)
    ft1 = ((1 - t) * (1 - t) * f01 - t * (1 - t) * f10).astype(np.float32)
    w0 = cv2.remap(frames[i], _gx + ft0[..., 0], _gy + ft0[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    w1 = cv2.remap(frames[i + 1], _gx + ft1[..., 0], _gy + ft1[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return cv2.addWeighted(w0, 1 - t, w1, t, 0)


def fetch(name, frames, pts, src_t, smooth):
    j = int(np.searchsorted(pts, src_t, side='right') - 1)
    j = max(0, min(j, len(pts) - 2))
    if not smooth:
        # nearest frame
        if abs(pts[j + 1] - src_t) < abs(pts[j] - src_t):
            j += 1
        return frames[j]
    t = (src_t - pts[j]) / max(1e-6, pts[j + 1] - pts[j])
    t = float(min(max(t, 0.0), 1.0))
    return interp(name, frames, j, t)


# darker clips (A-F parking lot + K, L, M) get a stronger boost
DARK_B = {0.000, 1.800, 3.890, 4.665, 5.230, 6.150, 7.390, 8.050, 8.500}
DARK_SAT, DARK_CONTRAST = 1.50, 1.08

def grade(img, name, dark=False):
    f = img.astype(np.float32)
    luma = f[..., 0:1] * 0.0722 + f[..., 1:2] * 0.7152 + f[..., 2:3] * 0.2126
    f = luma + (f - luma) * (DARK_SAT if dark else SAT[name])
    c = DARK_CONTRAST if dark else CONTRAST[name]
    f = (f - 128.0) * c + 128.0
    return np.clip(f, 0, 255)


def zoom_of(kind, local, dur):
    ease = lambda x: 1 - (1 - min(max(x, 0), 1)) ** 3
    if kind in ('hit', 'drop'):
        amp = 0.10 if kind == 'drop' else 0.065
        return 1 + amp * (1 - ease(local / 0.20))
    if kind == 'half':
        return 1 + 0.035 * (1 - ease(local / 0.16))
    if kind == 'shush':
        return 1.0 + 0.07 * ease(local / dur)          # slow push-in
    if kind == 'final':
        return 1.0 + 0.05 * (1 - ease(local / 0.20)) + 0.06 * (local / dur)   # punch, then slow push
    if kind == 'intro':
        return 1 + 0.03 * (1 - ease(local / 0.18))
    return 1.0


def flash_of(kind, local):
    if kind == 'drop':
        return 0.85 * math.exp(-local / 0.05)
    return 0.0


def main():
    preview = '--preview' in sys.argv
    out = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    data = {n: load_frames(n) for n in ('A', 'B')}
    total = END - S0
    N = int(round(total * FPS))
    print('frames', N, 'duration', N / FPS, file=sys.stderr)

    # normalise EDL entries
    clips = []
    for e in EDL:
        st, en, src, sin, sp, kind = e[:6]
        dur = en - st
        if sp is None:
            sout = e[6]
            sp = (sout - sin) / dur
        clips.append(dict(st=st, en=en, src=src, sin=sin, sp=sp, kind=kind, dur=dur))
        print(f'{st:7.3f}-{en:7.3f} {src} {sin:6.3f}->{sin + sp * dur:6.3f} x{sp:.3f} {kind}', file=sys.stderr)

    enc = None
    if not preview:
        enc = subprocess.Popen([
            'ffmpeg', '-v', 'error', '-y',
            '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUT_W}x{OUT_H}', '-r', str(FPS), '-i', '-',
            '-ss', f'{S0:.4f}', '-t', f'{N / FPS:.4f}', '-i', SONG,
            '-map', '0:v', '-map', '1:a',
            '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '4.2',
            '-x264-params', 'keyint=60:min-keyint=1',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
            '-r', str(FPS),
            '-af', f'afade=t=in:st=0:d=0.005,afade=t=out:st={N / FPS - 0.02:.4f}:d=0.02',
            '-c:a', 'aac', '-b:a', '320k', '-ar', '44100',
            '-movflags', '+faststart', '-shortest', out], stdin=subprocess.PIPE)

    canvas = np.zeros((OUT_H, OUT_W, 3), np.uint8)
    blur_k = (0, 0)
    sheet = []
    ci = 0
    for n in range(N):
        song_t = S0 + (n + 0.0) / FPS
        while ci < len(clips) - 1 and song_t >= clips[ci + 1]['st'] - 1e-9:
            ci += 1
        c = clips[ci]
        local = song_t - c['st']
        src_t = c['sin'] + local * c['sp']
        frames, pts = data[c['src']]
        img = fetch(c['src'], frames, pts, src_t, smooth=abs(c['sp'] - 1) > 0.02)

        z = zoom_of(c['kind'], local, c['dur'])
        # one resample: source -> content box, with zoom about centre
        s = CONT_W / SRC_W * z
        M = np.array([[s, 0, CONT_W / 2 - s * SRC_W / 2],
                      [0, s, CONT_H / 2 - s * SRC_H / 2]], np.float32)
        box = cv2.warpAffine(img, M, (CONT_W, CONT_H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
        f = grade(box, c['src'], dark=(c['src'] == 'B' and c['sin'] in DARK_B))
        # mild unsharp to offset the upscale
        bl = cv2.GaussianBlur(f, (0, 0), 1.1)
        f = f + 0.30 * (f - bl)
        fl = flash_of(c['kind'], local)
        if fl > 0.003:
            f = f * (1 - fl) + 255.0 * fl
        box = np.clip(f, 0, 255).astype(np.uint8)
        canvas[CONT_Y:CONT_Y + CONT_H] = box
        if preview:
            if abs(local - 0.0) < 0.5 / FPS or abs(song_t + 1.0 / FPS - c['en']) < 0.5 / FPS:
                sheet.append((ci, n, local, cv2.resize(box, (216, 210))))
        else:
            enc.stdin.write(canvas.tobytes())
        if n % 120 == 0:
            print('frame', n, file=sys.stderr)
            _flow_cache.clear()

    if preview:
        rows = []
        for k in range(0, len(sheet), 2):
            pair = sheet[k:k + 2]
            imgs = []
            for (ci2, n2, loc, im) in pair:
                im = im.copy()
                cv2.putText(im, f'c{ci2 + 1} f{n2}', (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                imgs.append(im)
            while len(imgs) < 2:
                imgs.append(np.zeros_like(sheet[0][3]))
            rows.append(np.hstack(imgs))
        # tile rows into a grid of 4 pairs per row
        per = 4
        grid = []
        for k in range(0, len(rows), per):
            r = rows[k:k + per]
            while len(r) < per:
                r.append(np.zeros_like(rows[0]))
            grid.append(np.hstack(r))
        cv2.imwrite(out, np.vstack(grid))
    else:
        enc.stdin.close()
        enc.wait()


if __name__ == '__main__':
    main()
