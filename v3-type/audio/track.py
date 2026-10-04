"""v3-type soundtrack: original funk-house groove, 120 BPM, E dorian vamp.
Sections (bars of 2 s):
  0-3   intro      filtered pad, muted bass, ticking hats, riser
  4-10  groove A   four-on-floor, claps, syncopated bass, offbeat stabs
  11-14 groove B   stab on every word change, tom fills, more percussion
  15-17 break      drums out, bells + pad in reverb, snare roll, riser, gap
  18-24 drop       sub boom, reese + bass, bright stabs, crash, full kit
  25-27 outro      groove continues, thinning
  28-29 end        final chord hit + tail
"""
import sys
sys.path.insert(0, '/Users/mac/projects/octos-promo/engine')
import numpy as np
from synthlib import *

BPM = 120
B = 60 / BPM          # beat
BAR = 4 * B
S16 = B / 4
DUR = 60.0
SWING = 0.018         # push of the off-16ths (s)

def st(bar, step):
    """time of 16th step in bar, with swing on odd steps"""
    return bar * BAR + step * S16 + (SWING if step % 2 else 0)

m = Mix(dur=DUR)

# ---------- sounds ----------
K = kick(dur=0.5, f_hi=170, f_lo=45, decay=0.3, click=0.3, drive=1.8)
K_soft = fft_filter(K, hi=600)
CL = clap()
SN = snare()
HC = hat()
HO = hat(open_=True)
RD = ride()
BOOM = sub_boom(dur=3.0)
TOM_H = kick(dur=0.3, f_hi=320, f_lo=150, pitch_decay=0.05, decay=0.14, click=0.1, drive=1.2)
TOM_L = kick(dur=0.35, f_hi=220, f_lo=95, pitch_decay=0.05, decay=0.16, click=0.1, drive=1.2)

def crash(dur=2.2, seed=31):
    t = tvec(dur)
    x = fft_filter(noise(dur, seed), lo=3500, hi=14000)
    return x * np.exp(-t / 0.7) * 0.5

CR = crash()

def shaker(seed=40):
    d = 0.07
    t = tvec(d)
    return fft_filter(noise(d, seed), lo=5000, hi=11000) * np.minimum(1, t / 0.01) * np.exp(-t / 0.025)

SH = shaker()

def stab(notes, dur=0.22, bright=5200, decay=0.11, seed=0):
    x = sum(supersaw(midi(n), dur, voices=5, detune=0.18, seed=seed + i) for i, n in enumerate(notes))
    x = x / np.sqrt(len(notes))
    x = sweep_lp(x, bright, 500, curve=0.6, res=0.3)
    x = fft_filter(x, lo=180)
    return x * perc(len(x), 0.003, decay)

def organ(notes, dur):
    """soft sine/tri chord for the break"""
    x = sum(tri(midi(n), dur) + 0.3 * sine(midi(n) * 2, dur) for n in notes) / len(notes)
    return x * adsr(len(x), 0.3, 1.0, 1.0, 0.8)

# chords (E dorian vamp): Em9 / A9 ; drop adds Cmaj9 / D6/9
EM9 = [55, 59, 62, 66]
A9 = [55, 59, 61, 64]
CM9 = [52, 55, 59, 62]
D69 = [54, 57, 59, 64]
ROOT = {'Em': 28, 'A': 33, 'C': 36, 'D': 38}

def chord_of(bar, drop=False):
    if drop:
        return [('C', CM9), ('D', D69), ('Em', EM9), ('A', A9)][bar % 4]
    return [('Em', EM9), ('A', A9)][bar % 2]

# bass patterns: (step, semis above root, length in 16ths)
PAT_A = [(0, 0, 2), (3, 0, 1), (4, 12, 1), (6, 10, 1), (7, 12, 1), (8, 0, 2), (10, 7, 1), (11, 0, 1), (13, 12, 1), (14, 10, 1), (15, 7, 1)]
PAT_B = [(0, 0, 3), (3, 12, 1), (5, 0, 1), (6, 10, 1), (8, 0, 1), (9, 12, 1), (11, 7, 2), (14, 3, 1), (15, 5, 1)]
PAT_INTRO = [(0, 0, 2), (6, 0, 1), (8, 0, 2), (11, 0, 1), (14, 10, 1)]

def bass_bar(bar, root, pat, gain=0.55, cutoff=900, bus='bass'):
    for step, semi, ln in pat:
        n = root + semi
        s = bass(n + 12, ln * S16 * 0.9, cutoff=cutoff, sub=-0.9, drive=2.0)
        m.add(s, st(bar, step), gain=gain, bus=bus)

kicks = []

def drums_bar(bar, kind, G=1.0):
    """kind: 'A', 'B', 'drop', 'outro'"""
    for b4 in range(4):
        t = bar * BAR + b4 * B
        m.add(K, t, gain=0.95 * G, bus='drums'); kicks.append(t)
    for b4 in (1, 3):
        m.add(CL, bar * BAR + b4 * B, gain=0.55 * G, pan=0.05, bus='drums', send=0.18)
        if kind == 'drop':
            m.add(SN, bar * BAR + b4 * B, gain=0.35 * G, bus='drums', send=0.1)
    for s in range(16):
        g = 0.16 if s % 4 == 2 else (0.1 if s % 2 else 0.07)
        if s % 4 == 2:
            m.add(HO, st(bar, s), gain=0.16 * G, pan=0.25, bus='drums')
        else:
            m.add(HC, st(bar, s), gain=g * G, pan=0.3, bus='drums')
        if kind in ('B', 'drop'):
            m.add(SH, st(bar, s), gain=(0.09 + 0.05 * (s % 4 == 3)) * G, pan=-0.4, bus='drums')
    if kind == 'drop':
        for b4 in range(4):
            m.add(RD, bar * BAR + b4 * B + B / 2, gain=0.22 * G, pan=-0.2, bus='drums', send=0.05)

def stabs_bar(bar, notes, steps, gain=0.28, bright=5200, pan=0.0):
    for i, s in enumerate(steps):
        m.add(stab(notes, bright=bright, seed=bar * 7 + i), st(bar, s), gain=gain, pan=pan, bus='music', send=0.25, width=0.6)

# ---------- intro 0-3 ----------
pad_int = pad(EM9 + [47], 4 * BAR + 1.0, cutoff=4000, attack=2.5, release=1.0, seed=3)
pad_int = sweep_lp(pad_int, 350, 2600, curve=1.5)
m.add(pad_int, 0.0, gain=0.34, bus='music', send=0.45, width=0.8)
for bar in range(4):
    for s in range(16):
        if bar >= 1 or s >= 8:
            m.add(HC, st(bar, s), gain=0.04 + 0.05 * (s % 4 == 2), pan=0.3, bus='drums')
    if bar >= 2:
        for b4 in range(4):
            t = bar * BAR + b4 * B
            m.add(K_soft, t, gain=0.4, bus='drums'); kicks.append(t)
    r, _ = chord_of(bar)
    bass_bar(bar, ROOT[r], PAT_INTRO, gain=0.35, cutoff=320)
m.add(riser(dur=2.0, seed=9, f0=500, f1=9000), 6.0, gain=0.22, bus='fx', send=0.3)
m.add(CL, 7.5, gain=0.5, bus='drums', send=0.4)
m.add(CL, 7.75, gain=0.35, bus='drums', send=0.4)

# ---------- groove A 4-10, B 11-14 ----------
for bar in range(4, 15):
    kind = 'A' if bar < 11 else 'B'
    drums_bar(bar, kind, 0.62 if kind == 'A' else 0.72)
    r, ch = chord_of(bar)
    bass_bar(bar, ROOT[r], PAT_A if bar % 4 != 3 else PAT_B, gain=0.36 if kind == 'A' else 0.42, cutoff=900 if kind == 'A' else 1300)
    if kind == 'A':
        stabs_bar(bar, ch, [6, 14] if bar % 2 == 0 else [3, 6, 14], gain=0.22, bright=4200)
    else:
        # a stab on every word change (beats 1 and 3) plus the offbeat push
        stabs_bar(bar, ch, [0, 6, 8, 14], gain=0.3, bright=6000)
    if bar in (4, 8, 11):
        m.add(CR, bar * BAR, gain=0.4, bus='drums', send=0.2)
# tom fills at the ends of phrases
for bar in (7, 10):
    for i, s in enumerate([10, 12, 13, 14, 15]):
        m.add(TOM_H if i < 2 else TOM_L, st(bar, s), gain=0.45, pan=-0.3 + 0.15 * i, bus='drums', send=0.1)
# pad under groove B
m.add(pad(A9 + [45], 4 * BAR, cutoff=2400, attack=0.8, seed=5), 11 * BAR, gain=0.12, bus='music', send=0.3, width=0.8)
m.add(riser(dur=2.0, seed=12), 28.0, gain=0.18, bus='fx', send=0.2)

# ---------- break 15-17 (30-36) ----------
m.add(CR, 30.0, gain=0.45, bus='fx', send=0.5)
m.add(BOOM, 30.0, gain=0.5, bus='fx')
brk = organ([52, 59, 62, 66, 71], 3 * BAR + 0.5)
m.add(fft_filter(brk, lo=150), 30.0, gain=0.3, bus='break', send=0.6, width=0.8)
m.add(pad([52, 59, 62, 66, 69], 3 * BAR, cutoff=3000, attack=1.5, seed=8), 30.0, gain=0.2, bus='break', send=0.6, width=0.8)
bell_line = [(0, 83), (0.75, 81), (1.5, 78), (2.5, 76), (3.0, 78), (3.75, 81), (4.5, 83), (5.0, 86)]
for off, n in bell_line:
    m.add(bell(n, 2.0), 30.0 + off, gain=0.16, pan=0.3 * np.sin(off * 3), bus='break', send=0.7)
# snare roll 34-35.5, accelerating
tt = 33.0
k = 0
while tt < 35.5:
    frac = (tt - 33.0) / 2.5
    m.add(SN, tt, gain=0.08 + 0.3 * frac ** 1.5, pan=0.1, bus='fx', send=0.2)
    tt += B / 2 if tt < 34.0 else (B / 4 if tt < 35.0 else B / 8)
    k += 1
rz = riser(dur=5.5, seed=14, f0=200, f1=14000)
m.add(rz, 30.0, gain=0.3, bus='fx', send=0.3)
m.add(reverse(fft_filter(CR, hi=9000)), 36.0 - len(CR) / SR, gain=0.3, bus='fx')
# kick 36-? quiet bass pulse through the break (filtered)
for bar in range(15, 18):
    for b4 in range(4):
        if bar == 17 and b4 == 3:
            continue
        m.add(K_soft, bar * BAR + b4 * B, gain=0.25 + 0.1 * (bar - 15), bus='fx')

# ---------- drop 18-24 (36-50) ----------
m.add(BOOM, 36.0, gain=0.9, bus='fx')
m.add(CR, 36.0, gain=0.55, bus='fx', send=0.3)
for bar in range(18, 25):
    drums_bar(bar, 'drop', 1.0)
    r, ch = chord_of(bar - 18, drop=True)
    root = ROOT[r]
    bass_bar(bar, root, PAT_B if bar % 2 else PAT_A, gain=0.55, cutoff=1600)
    m.add(reese(root + 12, BAR, cutoff=900), bar * BAR, gain=0.28, bus='bass')
    stabs_bar(bar, [n + 12 for n in ch], [0, 3, 6, 10, 14], gain=0.26, bright=8000, pan=0.15)
    stabs_bar(bar, ch, [6, 14], gain=0.22, bright=3000, pan=-0.15)
    if bar in (22,):
        m.add(CR, bar * BAR, gain=0.45, bus='drums', send=0.2)
    m.add(pad(ch + [ch[0] - 12], BAR, cutoff=3500, attack=0.05, release=0.3, seed=bar), bar * BAR, gain=0.12, bus='music', send=0.3, width=0.8)
for i, s in enumerate([8, 10, 12, 13, 14, 15]):
    m.add(TOM_H if i < 3 else TOM_L, st(21, s), gain=0.5, pan=-0.3 + 0.12 * i, bus='drums', send=0.1)
m.add(riser(dur=2.0, seed=17), 48.0, gain=0.2, bus='fx', send=0.2)

# ---------- outro 25-27 (50-56) ----------
m.add(CR, 50.0, gain=0.5, bus='drums', send=0.3)
for bar in range(25, 28):
    drums_bar(bar, 'A', 0.7)
    r, ch = chord_of(bar)
    bass_bar(bar, ROOT[r], PAT_A, gain=0.4, cutoff=1000)
    stabs_bar(bar, ch, [6, 14], gain=0.26, bright=4500)
# ---------- end 28-29 (56-60) ----------
m.add(BOOM, 56.0, gain=0.8, bus='fx')
m.add(CR, 56.0, gain=0.5, bus='fx', send=0.5)
m.add(K, 56.0, gain=1.0, bus='drums')
m.add(stab([n + 12 for n in EM9] + [52], dur=1.2, bright=6000, decay=0.5), 56.0, gain=0.4, bus='fx', send=0.8, width=0.8)
m.add(pad(EM9 + [40, 47], 4.0, cutoff=2600, attack=0.02, release=2.5, seed=21), 56.0, gain=0.26, bus='fx', send=0.6, width=0.8)
m.add(bass(28 + 12, 2.5, cutoff=500, sub=-0.9), 56.0, gain=0.5, bus='fx')
m.add(bell(83, 3.0), 56.0, gain=0.15, bus='fx', send=0.8)

m.sidechain(times=kicks, depth=0.55, release=0.2, buses=('music', 'bass'))
import os
if os.environ.get("DBG"):
    for k, b in m.bus.items(): print(k, "peak", np.abs(b).max(), "rms", np.sqrt((b**2).mean()))
m.write("/Users/mac/projects/octos-promo/v3-type/audio/track.wav", decay=2.4, fade_out=(58.6, 60.0), master_gain=float(os.environ.get("MG", "0.42")))
print('ok')
