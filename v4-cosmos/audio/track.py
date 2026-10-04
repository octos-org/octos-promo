"""COSMOS (v4) — original soundtrack for 巡天智能体 · Agentic Observer.
96 BPM, D minor / F lydian colours, 24 bars = 60.0 s. Timeline shared with the picture via cues.py -> cues.json.
  bars  0-4   night: drone, dark pads, distant star bells, dome motor rumble, riser
  bar   4     LIFT 1 (title): sub boom, bright F pad, bell cascade
  bars  6-10  the game: soft heartbeat kicks, 8th arps, a bell tick for every decision
  bars 10-12  weather: filter closes, wind, sparse decisions, dull 'wait' thuds
  bars 12-14  ToO alert: two-tone pings on an A chord, request tiles
  bar  14     NOVA: reverse swell -> impact + shimmer
  bars 15-17  time-lapse: four-on-floor, 16th ticks, score climbing
  bars 17-20  the competition: half-time, then a build (snare roll, riser)
  bars 20-24  LIFT 2 (call to action): boom, full pad, bells, long tail, fade
"""
import os
import sys
sys.path.insert(0, '/Users/mac/projects/octos-promo/engine')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synthlib import *  # noqa
from cues import CUES, BPM, BEAT, BAR, DUR, T, B  # noqa
import json

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, '..', 'cues.json'), 'w') as f:
    json.dump(CUES, f, indent=1)

m = Mix(dur=DUR)
rng = np.random.default_rng(26)

CH = {
    'Dm9': [50, 53, 57, 60, 64], 'Bbl': [46, 53, 57, 62, 64], 'F': [53, 57, 60, 67, 69], 'C': [48, 55, 60, 62, 67],
    'Gm': [43, 50, 55, 58, 62], 'A': [45, 52, 57, 61, 64], 'Dm': [50, 57, 60, 62, 65], 'Bb': [46, 53, 58, 62, 65],
}
ROOT = {'Dm9': 38, 'Dm': 38, 'Bbl': 34, 'Bb': 34, 'F': 41, 'C': 36, 'Gm': 31, 'A': 33}
PROG = {0: 'Dm9', 1: 'Dm9', 2: 'Bbl', 3: 'Bbl', 4: 'F', 5: 'C', 6: 'Dm', 7: 'Bb', 8: 'F', 9: 'C', 10: 'Gm', 11: 'Bb',
        12: 'A', 13: 'Dm', 14: 'Bbl', 15: 'F', 16: 'C', 17: 'Dm', 18: 'Bb', 19: 'Gm', 20: 'F', 21: 'C', 22: 'Dm9', 23: 'Bbl'}
SCALE = [62, 64, 65, 69, 72, 74, 76, 77, 81]  # D minor-ish pentatonic for decision ticks


def softpad(notes, dur, cutoff=1400, attack=1.0, release=1.0, seed=0, air=0.0):
    x = np.zeros(secs(dur))
    for i, n in enumerate(notes):
        f = midi(n)
        v = supersaw(f, dur, voices=4, detune=0.12, seed=seed + i) * 0.5
        v += tri(f * 1.002, dur, (seed * 0.13 + i * 0.29) % 1) * 0.6 + sine(f * 0.998, dur) * 0.5
        x += v
    x = x / np.sqrt(len(notes))
    x = fft_filter(x, lo=90, hi=cutoff, slope=2.5)
    if air:
        x += air * fft_filter(noise(dur, seed + 77), lo=4000, hi=9000) * 0.08
    t = tvec(dur)
    x *= 1 + 0.12 * np.sin(2 * np.pi * 0.21 * t + seed)
    return x * adsr(len(x), attack, 1.0, 1.0, release)


def star_bell(note, dur=3.0):
    t = tvec(dur)
    f = midi(note)
    mod = np.sin(2 * np.pi * f * 2.0 * t) * 1.2 * np.exp(-t / 0.5)
    x = np.sin(2 * np.pi * f * t + mod) * perc(len(t), 0.002, 1.1)
    x += 0.25 * np.sin(2 * np.pi * f * 4.01 * t) * perc(len(t), 0.001, 0.25)
    return x


def tick(note, dur=0.9):
    t = tvec(dur)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t / 0.08)) * perc(len(t), 0.001, 0.22)
    return x + 0.3 * pluck(note - 12, dur, bright=2500, decay=0.08)


def ping(note, dur=0.5):
    t = tvec(dur)
    f = midi(note)
    x = sine(f, dur) + 0.35 * square(f, dur, pw=0.3)
    return fft_filter(x, hi=5000) * perc(len(t), 0.002, 0.16)


def crash(dur=3.0, seed=40):
    t = tvec(dur)
    x = fft_filter(noise(dur, seed), lo=3500, hi=14000)
    return x * np.exp(-t / 0.9) * 0.5


def shimmer(dur, seed=5, lo=6000):
    t = tvec(dur)
    x = fft_filter(noise(dur, seed), lo=lo, hi=15000)
    return x * (0.5 + 0.5 * np.sin(2 * np.pi * 6.0 * t)) * 0.3


def wind(dur, seed=9):
    x = noise(dur, seed)
    x = sweep_lp(x, 300, 1400, curve=1.0, res=1.2)
    x = fft_filter(x, lo=120)
    t = tvec(dur)
    return x * (0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * t)) * np.clip(t / 1.5, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)


# ================================================================ drone + pads (whole piece)
dr = sine(midi(26), DUR) * 0.8 + sine(midi(38), DUR) * 0.3 + 0.12 * tri(midi(45), DUR)
dr = fft_filter(dr, hi=300) * adsr(secs(DUR), 3.0, 1.0, 1.0, 3.0)
dr_env = np.ones(secs(DUR))
dr *= np.clip(tvec(DUR) / T(4), 0.45, 1.0)
m.add(dr, at=0.0, gain=0.08, bus='bass')

for b in range(0, 24):
    c = PROG[b]
    if b in (1, 3):
        continue  # intro chords last 2 bars
    length = 2 * BAR if b in (0, 2) else BAR
    if b < 4:
        cut, g, att = 700 + 180 * b, 0.13, 1.6
    elif b < 6:
        cut, g, att = 3200, 0.26, 0.05
    elif b < 10:
        cut, g, att = 1800, 0.20, 0.3
    elif b < 12:
        cut, g, att = 800, 0.20, 0.6
    elif b < 15:
        cut, g, att = 2200, 0.24, 0.1
    elif b < 17:
        cut, g, att = 2600, 0.22, 0.05
    elif b < 20:
        cut, g, att = 1600 + 400 * (b - 17), 0.20, 0.1
    else:
        cut, g, att = 3600 - 500 * (b - 20), 0.34, 0.03
    rel = 2.8 if b == 23 else 0.6
    m.add(softpad(CH[c], length + rel * 0.5, cutoff=cut, attack=att, release=rel, seed=b * 3, air=1.0 if b >= 20 or 4 <= b < 6 else 0.0),
          at=T(b), gain=g, bus='music', send=0.6, width=0.7)
    # sub root
    s = sine(midi(ROOT[c]), length) * adsr(secs(length), 0.2, 1, 1, 0.4)
    m.add(s, at=T(b), gain=0.12 if b >= 4 else 0.035, bus='bass')

# ================================================================ intro (bars 0-4)
for i, t0 in enumerate(CUES['bells']):
    n = [81, 76, 79, 74, 81, 84][i]
    m.add(star_bell(n, 4.0), at=t0, gain=0.10, pan=(-0.55 if i % 2 else 0.55), bus='music', send=0.9)
# dome motor + shutter rumble
d0 = CUES['dome']
mot = fft_filter(noise(4.2, 12), lo=40, hi=260) * 0.7 + 0.25 * saw(55 + 3 * np.sin(np.arange(secs(4.2)) / SR * 7), 4.2)
mot = fft_filter(mot, hi=500) * adsr(secs(4.2), 0.6, 1.0, 1.0, 1.2)
m.add(mot, at=d0 + 0.3, gain=0.10, bus='fx', send=0.3, width=0.5)
m.add(fft_filter(kick(0.6, f_hi=90, f_lo=40, decay=0.25, click=0.02), hi=900), at=d0 + 4.3, gain=0.35, bus='fx', send=0.4)
# riser into the title
m.add(riser(BAR * 1.0, seed=7, f0=400, f1=9000), at=T(3), gain=0.18, bus='fx', send=0.4, width=1.0)
rc = reverse(crash(2.0, 44))
m.add(rc, at=T(4) - len(rc) / SR, gain=0.35, bus='fx', send=0.5)

# ================================================================ LIFT 1 (bar 4)
L1 = CUES['lift1']
m.add(sub_boom(3.0, 72, 30), at=L1, gain=0.85, bus='impact')
m.add(crash(3.5, 41), at=L1, gain=0.45, bus='fx', send=0.8, width=1.0)
for i, n in enumerate([69, 72, 76, 77, 81, 84, 88]):
    m.add(star_bell(n, 3.5), at=L1 + i * BEAT * 0.5, gain=0.09, pan=0.6 * np.sin(i * 1.7), bus='music', send=0.9)
m.add(shimmer(2 * BAR, 3) * adsr(secs(2 * BAR), 0.3, 1, 1, 2.0), at=L1, gain=0.25, bus='fx', send=0.6, width=1.0)

# ================================================================ game (bars 6-10), arps
for b in list(range(6, 10)) + list(range(15, 19)):
    notes = sorted(CH[PROG[b]])
    for k in range(8):
        n = notes[[0, 2, 1, 3, 2, 4, 3, 1][k]] + 12
        br = 1400 + 200 * k if b < 10 else 2400
        m.add(pluck(n, 0.45, bright=br, decay=0.14), at=T(b, k * 0.5), gain=0.05 if b < 8 else 0.065,
              pan=0.45 * np.sin(k * 1.1 + b), bus='music', send=0.55)
for b in range(8, 10):
    for k in range(8):
        m.add(hat(seed=5 + k), at=T(b, k * 0.5 + 0.5), gain=0.05 if k % 2 else 0.08, pan=0.3, bus='drums')

# decision ticks
for i, p in enumerate(CUES['picks']):
    if p['kind'] == 'fast':
        n = SCALE[(i * 3) % len(SCALE)] + 12
        m.add(tick(n, 0.5), at=p['t'], gain=0.035, pan=0.6 * np.sin(i * 0.9), bus='music', send=0.4)
    elif p['kind'] == 'too':
        m.add(tick(76 + [0, 5, 12][i % 3], 1.0), at=p['t'], gain=0.12, pan=0.4, bus='music', send=0.6)
    else:
        n = SCALE[(i * 5) % len(SCALE)] + 12
        m.add(tick(n, 0.9), at=p['t'], gain=0.075, pan=0.5 * np.sin(i * 2.3), bus='music', send=0.6)

# ================================================================ weather (bars 10-12)
m.add(wind(2 * BAR + 1.5, 9), at=T(10) - 0.8, gain=0.22, bus='fx', send=0.4, width=1.0)
for w in CUES['waits']:
    m.add(fft_filter(kick(0.5, f_hi=80, f_lo=45, decay=0.2, click=0.0), hi=400), at=w, gain=0.25, bus='fx', send=0.3)

# ================================================================ ToO (bars 12-14)
for k, t0 in enumerate(CUES['alarm']):
    m.add(ping(81 if k % 2 == 0 else 88, 0.5), at=t0, gain=0.10, pan=(-0.3 if k % 2 else 0.3), bus='lead', send=0.5)
m.add(crash(2.0, 45), at=CUES['too'], gain=0.3, bus='fx', send=0.6, width=1.0)
m.add(star_bell(88, 3.0), at=CUES['toodone'], gain=0.10, bus='music', send=0.8)
m.add(star_bell(93, 3.0), at=CUES['toodone'] + BEAT * 0.5, gain=0.07, bus='music', send=0.8)

# ================================================================ NOVA (bar 14)
NV = CUES['nova']
sw = reverse(fft_filter(noise(2.0, 51), lo=1500, hi=12000) * np.exp(-tvec(2.0) / 0.5)) * 0.8
m.add(sw, at=NV - 2.0, gain=0.35, bus='fx', send=0.6, width=1.0)
m.add(sub_boom(3.2, 80, 28), at=NV, gain=1.0, bus='impact')
m.add(crash(4.0, 46), at=NV, gain=0.55, bus='fx', send=0.8, width=1.0)
for i, n in enumerate([86, 90, 93, 98]):
    m.add(star_bell(n, 3.0), at=NV + i * 0.06, gain=0.08, pan=0.5 * np.sin(i * 2), bus='music', send=0.95)
m.add(shimmer(BAR * 1.5, 8, lo=5000) * adsr(secs(BAR * 1.5), 0.05, 1, 1, 2.0), at=NV, gain=0.3, bus='fx', send=0.7, width=1.0)
m.add(star_bell(81, 2.0), at=CUES['report'], gain=0.08, bus='music', send=0.8)
m.add(star_bell(88, 2.0), at=CUES['report'] + BEAT * 0.25, gain=0.07, bus='music', send=0.8)

# ================================================================ time-lapse (bars 15-17)
for b in (15, 16):
    for bt in (1, 3):
        m.add(clap(), at=T(b, bt), gain=0.28, bus='drums', send=0.3)
    for k in range(16):
        if k % 4 == 0:
            continue
        m.add(hat(seed=9 + k), at=T(b, k * 0.25), gain=0.09 if k % 2 == 0 else 0.05, pan=0.35, bus='drums')
    for k in range(8):
        m.add(bass(ROOT[PROG[b]], BEAT * 0.45, cutoff=420, sub=0.9), at=T(b, k * 0.5), gain=0.13, bus='bass')

# ================================================================ competition + build (bars 17-20)
for b in (17, 18):
    m.add(clap(), at=T(b, 2), gain=0.2, bus='drums', send=0.5)
    for k in range(8):
        m.add(hat(seed=3 + k), at=T(b, k * 0.5 + 0.5), gain=0.05, pan=-0.3, bus='drums')
snr = [T(19, k * 0.5) for k in range(4)] + [T(19, 2 + k * 0.25) for k in range(8)]
for i, s in enumerate(snr):
    m.add(snare(), at=s, gain=0.05 + 0.13 * i / len(snr), bus='drums', send=0.35)
m.add(riser(BAR, seed=11, f0=400, f1=12000), at=T(19), gain=0.15, bus='fx', send=0.4, width=1.0)
rc2 = reverse(crash(2.4, 47))
m.add(rc2, at=T(20) - len(rc2) / SR, gain=0.4, bus='fx', send=0.5)

# ================================================================ LIFT 2 (bar 20) + outro
L2 = CUES['lift2']
m.add(sub_boom(4.0, 78, 28), at=L2, gain=1.0, bus='impact')
m.add(crash(4.5, 43), at=L2, gain=0.55, bus='fx', send=0.8, width=1.0)
for i, (bt, n) in enumerate([(0, 69), (0.5, 72), (1, 76), (1.5, 81), (3, 79), (4, 77), (5, 76), (6, 74), (8, 81), (9, 84), (10.5, 88), (12, 86)]):
    m.add(star_bell(n, 3.5), at=L2 + bt * BEAT, gain=0.09, pan=(-0.45 if i % 2 else 0.45), bus='music', send=0.9)
m.add(shimmer(4 * BAR, 13) * adsr(secs(4 * BAR), 0.4, 1, 1, 4.0), at=L2, gain=0.2, bus='fx', send=0.6, width=1.0)
# arps carry the call to action
for b in (20, 21, 22):
    notes = sorted(CH[PROG[b]])
    for k in range(8):
        n = notes[[0, 2, 4, 3, 1, 3, 2, 4][k]] + 12
        m.add(pluck(n, 0.5, bright=2600 - 400 * (b - 20), decay=0.16), at=T(b, k * 0.5), gain=0.06 * (1 - 0.25 * (b - 20)),
              pan=0.5 * np.sin(k * 1.3 + b), bus='music', send=0.7)
# heartbeat callback in the tail
for b in (21, 22):
    for bt in (0, 2):
        m.add(fft_filter(kick(0.5, f_hi=110, f_lo=42, decay=0.3, click=0.05), hi=1600), at=T(b, bt), gain=0.25, bus='drums')

# ================================================================ drums out
K = kick(0.5, f_hi=160, f_lo=44, decay=0.3, click=0.2, drive=1.6)
KS = fft_filter(kick(0.5, f_hi=120, f_lo=42, decay=0.28, click=0.05, drive=1.3), hi=2000)
for t0, g, kind in CUES['kicks']:
    m.add(K if kind == 'kick' else KS, at=t0, gain=g * (0.75 if kind == 'kick' else 0.6), bus='drums')

m.sidechain([t for t, g, k in CUES['kicks'] if g >= 0.5], depth=0.45, release=0.3, buses=('music', 'bass'))

m.write(os.path.join(HERE, 'track.wav'), decay=3.6, master_gain=1.1, fade_out=(57.0, 60.0))
print('written; picks', len(CUES['picks']))
