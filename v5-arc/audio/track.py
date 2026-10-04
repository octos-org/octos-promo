"""v5-arc soundtrack: "The Factory" — mechanical techno, 128 BPM, D minor, 32 bars = 60 s.
Sections (bars of 1.875 s):
  0-3   intro      drone, clock ticks, three anvil clanks on the title lines, riser
  4-7   arc-bench  slam at bar 4, half-time machine groove, four stamps on the track slabs (bar 6)
  8-13  pipeline   four-on-floor; impl = stamp, check pass = blip, fail = buzzer, repair = ratchet, checkpoint = save chord
  14-17 test wall  build: flip ticks, snare in at 16, fix-all sweep, snapshot at 17, roll + riser
  18-19 break      drums out, pad + bells, hydraulic press at 19, reverse crash
  20-27 drop       sub boom, full kit, reese, stabs; result hits at 24 / 24.1 / 24.2, 26, 27
  28-31 outro      logo build, final hit at 30, tail
"""
import os
import sys
sys.path.insert(0, '/Users/mac/projects/octos-promo/engine')
import numpy as np
from synthlib import *

BPM = 128
B = 60 / BPM
BAR = 4 * B
S16 = B / 4
DUR = 60.0


def bt(bar, beat=0.0):
    return bar * BAR + beat * B


def st(bar, step):
    return bar * BAR + step * S16


m = Mix(dur=DUR)
kicks = []

# ---------- sound design ----------
K = kick(dur=0.45, f_hi=180, f_lo=44, decay=0.26, click=0.35, drive=2.2)
K_soft = fft_filter(K, hi=500)
SN = snare()
CL = clap()
HC = hat()
HO = hat(open_=True)
BOOM = sub_boom(dur=3.0)


def clank(f0=420, dur=0.6, decay=0.16, seed=1, bright=1.0):
    """metallic hit: inharmonic partials + noise transient"""
    t = tvec(dur)
    ratios = [1.0, 2.76, 5.40, 8.93, 13.34]
    x = sum(np.sin(2 * np.pi * f0 * r * t + seed * i) * np.exp(-t / (decay / (1 + 0.5 * i))) / (1 + 0.6 * i)
            for i, r in enumerate(ratios))
    n = fft_filter(noise(dur, seed), lo=2000, hi=9000 * bright) * np.exp(-t / 0.006) * 0.8
    return (x * 0.6 + n) * np.minimum(1, t / 0.0008)


def hiss(dur=0.5, seed=2, lo=3000, hi=12000, a=0.01, d=0.2):
    t = tvec(dur)
    return fft_filter(noise(dur, seed), lo=lo, hi=hi) * np.minimum(1, t / a) * np.exp(-t / d)


def blip(note, dur=0.12, decay=0.05):
    t = tvec(dur)
    return (sine(midi(note), dur) + 0.3 * square(midi(note) * 2, dur)) * np.exp(-t / decay) * np.minimum(1, t / 0.002)


def buzzer(dur=0.26):
    t = tvec(dur)
    x = square(midi(38), dur) + square(midi(38) * 1.02, dur) + 0.5 * square(midi(45) * 0.99, dur)
    x = fft_filter(x, lo=80, hi=2400)
    return x * adsr(len(x), 0.004, 0.2, 0.8, 0.04) * 0.5


def ratchet(dur=0.4, n=10, seed=5):
    out = np.zeros(secs(dur))
    for i in range(n):
        c = clank(1800 + 90 * i, dur=0.05, decay=0.01, seed=seed + i)
        j = secs(i * dur / n)
        out[j:j + len(c)] += c[: len(out) - j] * (0.5 + 0.5 * i / n)
    return out


def stamp():
    """industrial press stamp: low thud + clank"""
    t = tvec(0.35)
    th = kick(dur=0.35, f_hi=120, f_lo=60, pitch_decay=0.02, decay=0.08, click=0.5, drive=2.5)
    return th * 0.8 + clank(310, 0.35, 0.09, seed=9) * 0.35


def crash(dur=2.2, seed=31):
    t = tvec(dur)
    return fft_filter(noise(dur, seed), lo=3500, hi=14000) * np.exp(-t / 0.7) * 0.5


CR = crash()


def stab(notes, dur=0.24, bright=5000, decay=0.1, seed=0):
    x = sum(supersaw(midi(n), dur, voices=5, detune=0.16, seed=seed + i) for i, n in enumerate(notes))
    x = x / np.sqrt(len(notes))
    x = sweep_lp(x, bright, 400, curve=0.6, res=0.35)
    x = fft_filter(x, lo=160)
    return x * perc(len(x), 0.003, decay)


def drone(note, dur):
    x = saw(midi(note), dur) + saw(midi(note) * 1.004, dur, 0.3) + 0.8 * sine(midi(note) / 2, dur)
    return fft_filter(x, hi=500) * adsr(secs(dur), 1.5, 1.0, 1.0, 1.0)


# D minor: Dm / Bb / F / C
DM = [50, 53, 57, 62]
BB = [50, 53, 58, 62]
FM = [48, 53, 57, 60]
CM = [48, 52, 55, 60]
PROG = [(26, DM), (22, BB), (29, FM), (24, CM)]  # (bass root midi, chord)

BASS_PIPE = [(0, 0, 1), (2, 12, 1), (3, 0, 1), (6, 0, 1), (7, 12, 1), (8, 0, 1), (10, 12, 1), (11, 10, 1), (14, 0, 1), (15, 7, 1)]
BASS_DROP = [(0, 0, 2), (3, 0, 1), (4, 12, 1), (6, 0, 1), (7, 12, 1), (8, 0, 2), (10, 12, 1), (11, 0, 1), (13, 12, 1), (14, 10, 1), (15, 7, 1)]


def bass_bar(bar, root, pat, gain=0.5, cutoff=900):
    for step, semi, ln in pat:
        s = bass(root + semi + 12, ln * S16 * 0.9, cutoff=cutoff, sub=-0.9, drive=2.2)
        m.add(s, st(bar, step), gain=gain, bus='bass')


def four(bar, g=0.95, k=K):
    for b4 in range(4):
        t = bt(bar, b4)
        m.add(k, t, gain=g, bus='drums')
        kicks.append(t)


def hats(bar, g=1.0, open_off=True, sixteenth=True):
    for s in range(16):
        if s % 4 == 2 and open_off:
            m.add(HO, st(bar, s), gain=0.13 * g, pan=0.25, bus='drums')
        elif sixteenth:
            m.add(HC, st(bar, s), gain=(0.09 if s % 2 else 0.05) * g, pan=0.3, bus='drums')


def machine(bar, g=1.0, seed=0):
    """mechanical 16th percussion: little clanks on a fixed pattern"""
    pat = [3, 6, 11, 13]
    for i, s in enumerate(pat):
        m.add(clank(900 + 140 * ((bar + i) % 3), 0.2, 0.05, seed=seed + i), st(bar, s), gain=0.07 * g, pan=-0.35 + 0.23 * i, bus='drums', send=0.1)


# ---------- 0-3 intro ----------
m.add(drone(26, 4 * BAR + 0.8), 0.0, gain=0.3, bus='music', send=0.3)
m.add(sweep_lp(pad(DM + [45], 4 * BAR + 0.5, cutoff=4000, attack=2.5, seed=3), 300, 2400, curve=1.4), 0.0, gain=0.26, bus='music', send=0.5, width=0.8)
for bar in range(1, 4):
    for b4 in range(4):
        m.add(clank(2400, 0.06, 0.012, seed=bar * 4 + b4), bt(bar, b4 + 0.5), gain=0.05, pan=0.4, bus='drums')
        m.add(HC, bt(bar, b4), gain=0.05, pan=-0.3, bus='drums')
# title lines: anvil clanks on bar 1.0, 2.0, 3.0 (visual text hits)
for i, t in enumerate([bt(1), bt(2), bt(3)]):
    m.add(clank(196 * (1.0 + 0.12 * i), 1.2, 0.35, seed=20 + i), t, gain=0.32, pan=-0.2 + 0.2 * i, bus='fx', send=0.5)
    m.add(K_soft, t, gain=0.5, bus='drums')
m.add(hiss(1.2, seed=4, lo=1500, d=0.5), bt(2, 2), gain=0.1, pan=0.5, bus='fx', send=0.3)
m.add(riser(dur=BAR, seed=9, f0=400, f1=10000), bt(3), gain=0.25, bus='fx', send=0.3)
m.add(reverse(fft_filter(CR, hi=8000)), bt(4) - len(CR) / SR, gain=0.22, bus='fx')

# ---------- 4-7 ARC-BENCH ----------
m.add(BOOM, bt(4), gain=0.8, bus='fx')
m.add(CR, bt(4), gain=0.45, bus='fx', send=0.3)
m.add(clank(147, 1.6, 0.5, seed=33), bt(4), gain=0.35, bus='fx', send=0.5)
for bar in range(4, 8):
    for b4 in (0, 2):
        t = bt(bar, b4); m.add(K, t, gain=0.85, bus='drums'); kicks.append(t)
    m.add(CL, bt(bar, 2), gain=0.35, bus='drums', send=0.25)
    hats(bar, 0.7, open_off=False)
    machine(bar, 0.8, seed=bar)
    root, ch = PROG[0] if bar % 2 == 0 else PROG[1]
    m.add(bass(root + 12, BAR * 0.95, cutoff=380, sub=-0.9), bt(bar), gain=0.3, bus='bass')
    m.add(pad(ch, BAR, cutoff=1800, attack=0.2, seed=bar), bt(bar), gain=0.1, bus='music', send=0.3, width=0.7)
# four track slabs at bar 6, beats 0..3
for i in range(4):
    m.add(stamp(), bt(6, i), gain=0.55, pan=-0.3 + 0.2 * i, bus='fx', send=0.15)
    m.add(stab([n + 12 for n in DM], dur=0.2, bright=3500 + 700 * i, seed=40 + i), bt(6, i), gain=0.16, bus='music', send=0.3)
# fill into the pipeline
for i, s in enumerate([8, 10, 12, 13, 14, 15]):
    m.add(clank(600 - 50 * i, 0.2, 0.06, seed=50 + i), st(7, s), gain=0.2, pan=-0.3 + 0.12 * i, bus='drums', send=0.1)
m.add(riser(dur=BAR, seed=12, f0=600, f1=9000), bt(7), gain=0.16, bus='fx', send=0.2)

# ---------- 8-13 pipeline ----------
m.add(CR, bt(8), gain=0.4, bus='fx', send=0.3)
for bar in range(8, 14):
    four(bar, 0.9)
    hats(bar, 0.85)
    machine(bar, 1.0, seed=bar * 3)
    root, ch = PROG[0 if (bar // 2) % 2 == 0 else 1]
    bass_bar(bar, root, BASS_PIPE, gain=0.36, cutoff=800 + 60 * (bar - 8))
    m.add(CL, bt(bar, 1), gain=0.3, bus='drums', send=0.2)
    m.add(CL, bt(bar, 3), gain=0.3, bus='drums', send=0.2)
# pipeline events (beats counted from 0; bar 8 = beat 32). Same list as the visuals.
EV = [('seed', 32), ('impl', 34), ('pass', 35), ('impl', 36), ('pass', 37), ('impl', 38), ('fail', 39), ('repair', 40), ('pass', 41),
      ('impl', 42), ('pass', 43), ('save', 44), ('impl', 45), ('pass', 46), ('impl', 47), ('fail', 48), ('repair', 49), ('pass', 50),
      ('impl', 51), ('pass', 52), ('impl', 53), ('pass', 54), ('save', 55)]
for kind, beat in EV:
    t = beat * B
    if kind == 'seed':
        m.add(hiss(0.8, seed=6, lo=800, d=0.3), t, gain=0.14, bus='fx', send=0.3)
        m.add(bell(74, 1.5), t, gain=0.12, bus='fx', send=0.5)
    elif kind == 'impl':
        m.add(stamp(), t, gain=0.3, pan=-0.25, bus='fx', send=0.1)
    elif kind == 'pass':
        m.add(blip(86), t, gain=0.14, pan=0.3, bus='fx', send=0.2)
        m.add(blip(93), t + S16, gain=0.12, pan=0.3, bus='fx', send=0.2)
    elif kind == 'fail':
        m.add(buzzer(), t, gain=0.22, pan=0.2, bus='fx', send=0.15)
    elif kind == 'repair':
        m.add(ratchet(0.42), t, gain=0.22, pan=-0.1, bus='fx', send=0.15)
    elif kind == 'save':
        m.add(stab([n + 12 for n in FM], dur=0.5, bright=6000, decay=0.25, seed=beat), t, gain=0.24, bus='music', send=0.5, width=0.7)
        m.add(BOOM[: secs(0.9)] * np.linspace(1, 0, secs(0.9)), t, gain=0.4, bus='fx')
        m.add(hiss(0.9, seed=beat, lo=2000, d=0.35), t, gain=0.12, bus='fx', send=0.4)

# ---------- 14-17 test wall ----------
m.add(CR, bt(14), gain=0.4, bus='fx', send=0.3)
for bar in range(14, 18):
    four(bar, 0.95)
    hats(bar, 1.0)
    machine(bar, 1.0, seed=bar * 5)
    if bar >= 16:
        m.add(SN, bt(bar, 1), gain=0.3, bus='drums', send=0.15)
        m.add(SN, bt(bar, 3), gain=0.3, bus='drums', send=0.15)
    root, ch = PROG[(bar - 14) % 4]
    bass_bar(bar, root, BASS_PIPE, gain=0.4, cutoff=1100)
    m.add(pad(ch, BAR, cutoff=2600, attack=0.05, release=0.3, seed=bar), bt(bar), gain=0.1, bus='music', send=0.3, width=0.8)
# flip ticks: 16th clicks over the waves (bar 14-15 and 16)
for s in range(32):
    m.add(clank(2600 + 40 * (s % 5), 0.05, 0.01, seed=60 + s), st(14, s), gain=0.05, pan=np.sin(s * 0.7) * 0.6, bus='fx')
for s in range(16):
    m.add(clank(3000 + 60 * (s % 3), 0.05, 0.01, seed=90 + s), st(16, s), gain=0.06, pan=np.cos(s * 0.9) * 0.6, bus='fx')
m.add(riser(dur=BAR, seed=14, f0=300, f1=8000), bt(16), gain=0.14, bus='fx', send=0.2)
# snapshot "ship best" at bar 17
m.add(stab([n + 12 for n in DM] + [74], dur=0.4, bright=7000, decay=0.2, seed=77), bt(17), gain=0.26, bus='music', send=0.5, width=0.8)
m.add(hiss(0.3, seed=17, lo=5000, d=0.05), bt(17), gain=0.25, bus='fx')
# snare roll bar 17 beat 2 → 18
tt = bt(17, 2)
while tt < bt(18) - 1e-6:
    frac = (tt - bt(17, 2)) / (2 * B)
    m.add(SN, tt, gain=0.1 + 0.25 * frac, bus='fx', send=0.15)
    tt += S16 if frac < 0.5 else S16 / 2

# ---------- 18-19 break ----------
m.add(CR, bt(18), gain=0.35, bus='fx', send=0.6)
m.add(pad(DM + [45, 38], 2 * BAR + 0.8, cutoff=3000, attack=0.6, release=1.0, seed=8), bt(18), gain=0.22, bus='break', send=0.6, width=0.8)
for i, (off, n) in enumerate([(0, 81), (0.5, 77), (1.0, 74), (1.5, 72), (2.5, 74), (3.0, 77)]):
    m.add(bell(n, 1.8), bt(18) + off * B, gain=0.11, pan=0.3 * np.sin(i * 1.7), bus='break', send=0.7)
# counter ticks while main.py shrinks (bar 18 beat 2 → bar 19)
for s in range(8, 16):
    m.add(clank(2200 + 100 * s, 0.05, 0.01, seed=110 + s), st(18, s), gain=0.05, bus='fx')
# hydraulic press at bar 19
m.add(stamp(), bt(19), gain=0.8, bus='fx', send=0.3)
m.add(BOOM, bt(19), gain=0.55, bus='fx')
m.add(hiss(1.4, seed=19, lo=900, hi=9000, a=0.02, d=0.6), bt(19), gain=0.2, bus='fx', send=0.4)
m.add(riser(dur=BAR * 0.9, seed=21, f0=250, f1=14000), bt(19, 0.4), gain=0.28, bus='fx', send=0.3)
m.add(reverse(fft_filter(CR, hi=9000)), bt(20) - len(CR) / SR, gain=0.3, bus='fx')

# ---------- 20-27 drop ----------
m.add(BOOM, bt(20), gain=0.9, bus='fx')
m.add(CR, bt(20), gain=0.55, bus='fx', send=0.3)
for bar in range(20, 28):
    four(bar, 1.0)
    hats(bar, 1.1)
    machine(bar, 1.2, seed=bar * 7)
    m.add(SN, bt(bar, 1), gain=0.32, bus='drums', send=0.1)
    m.add(SN, bt(bar, 3), gain=0.32, bus='drums', send=0.1)
    m.add(CL, bt(bar, 1), gain=0.3, bus='drums', send=0.2)
    m.add(CL, bt(bar, 3), gain=0.3, bus='drums', send=0.2)
    root, ch = PROG[(bar - 20) % 4]
    bass_bar(bar, root, BASS_DROP, gain=0.5, cutoff=1500)
    m.add(reese(root + 12, BAR, cutoff=850), bt(bar), gain=0.24, bus='bass')
    for i, s in enumerate([0, 3, 6, 10, 14]):
        m.add(stab([n + 12 for n in ch], bright=7500, seed=bar * 11 + i), st(bar, s), gain=0.2, pan=0.15, bus='music', send=0.25, width=0.6)
    m.add(pad(ch + [ch[0] - 12], BAR, cutoff=3200, attack=0.05, release=0.3, seed=bar), bt(bar), gain=0.1, bus='music', send=0.3, width=0.8)
    if bar in (24,):
        m.add(CR, bt(bar), gain=0.45, bus='fx', send=0.3)
# site reveals bar 20-23: a stamp every 2 beats on the first six slots (visual: six sites)
for i in range(6):
    m.add(stamp(), bt(20 + i // 2, (i % 2) * 2), gain=0.35, pan=-0.4 + 0.16 * i, bus='fx', send=0.15)
# results: full-marks hits at bar 24 beats 0,1,2; bookstack at 26; keep at 27
for i in range(3):
    m.add(bell(86 + [0, 3, 7][i], 1.2), bt(24, i), gain=0.12, bus='fx', send=0.5)
for bar in (26, 27):
    # tile ripple: 16th ticks over the first beat, then the score hit on beat 2
    for s in range(4):
        m.add(clank(2400 + 200 * s, 0.05, 0.012, seed=170 + bar * 4 + s), st(bar, s), gain=0.07, pan=-0.3 + 0.2 * s, bus='fx')
    t = bt(bar, 1)
    m.add(BOOM[: secs(1.2)] * np.linspace(1, 0, secs(1.2)), t, gain=0.45, bus='fx')
    m.add(clank(220, 1.0, 0.3, seed=bar * 10), t, gain=0.25, bus='fx', send=0.4)
    m.add(bell(86 if bar == 26 else 84, 1.2), t, gain=0.1, bus='fx', send=0.5)
for i, s in enumerate([8, 10, 12, 13, 14, 15]):
    m.add(clank(700 - 60 * i, 0.2, 0.06, seed=130 + i), st(27, s), gain=0.25, pan=-0.3 + 0.12 * i, bus='drums', send=0.1)

# ---------- 28-31 outro ----------
m.add(CR, bt(28), gain=0.45, bus='fx', send=0.4)
for bar in range(28, 30):
    four(bar, 0.8)
    hats(bar, 0.8)
    root, ch = PROG[(bar - 28) % 4]
    bass_bar(bar, root, BASS_PIPE, gain=0.36, cutoff=900)
    for i, s in enumerate([0, 6, 10, 14]):
        m.add(stab([n + 12 for n in ch], bright=5000, seed=bar * 13 + i), st(bar, s), gain=0.17, bus='music', send=0.3, width=0.6)
# voxel assemble ticks
for s in range(28):
    m.add(clank(1800 + 50 * (s % 7), 0.05, 0.01, seed=150 + s), st(28, 4 + s), gain=0.035, pan=np.sin(s) * 0.7, bus='fx')
m.add(riser(dur=BAR, seed=29, f0=400, f1=12000), bt(29), gain=0.2, bus='fx', send=0.3)
# final hit bar 30
m.add(BOOM, bt(30), gain=0.85, bus='fx')
m.add(CR, bt(30), gain=0.5, bus='fx', send=0.5)
m.add(K, bt(30), gain=1.0, bus='drums')
m.add(clank(110, 2.5, 0.8, seed=200), bt(30), gain=0.3, bus='fx', send=0.7)
m.add(stab([n + 12 for n in DM] + [50], dur=1.4, bright=6000, decay=0.6), bt(30), gain=0.34, bus='fx', send=0.8, width=0.8)
m.add(pad(DM + [38, 45], 3.8, cutoff=2600, attack=0.02, release=2.4, seed=21), bt(30), gain=0.24, bus='fx', send=0.6, width=0.8)
m.add(bass(26 + 12, 2.5, cutoff=500, sub=-0.9), bt(30), gain=0.45, bus='fx')
m.add(bell(86, 3.0), bt(30), gain=0.13, bus='fx', send=0.8)

m.sidechain(times=kicks, depth=0.55, release=0.2, buses=('music', 'bass'))
if os.environ.get('DBG'):
    for k, b in m.bus.items():
        print(k, 'peak', np.abs(b).max(), 'rms', np.sqrt((b ** 2).mean()))
m.write('/Users/mac/projects/octos-promo/v5-arc/audio/track.wav', decay=2.2, fade_out=(58.6, 60.0), master_gain=float(os.environ.get('MG', '0.42')))
print('ok')
