"""WIRE — original soundtrack for the Octos promo (v2-wire).
128 BPM, F minor, 32 bars + tail. Structure (bars):
  0-4  boot     : pad swell, filtered arp, boot bell, hats from bar 2
  4-8  kernel   : kick in, offbeat bass, 8 bell pings (arms light up), clap from bar 6
  8-12 protocol : full groove, ride, packet blips, rolling bass
 12-16 crates   : build — filter opening, snare roll, 4-bar riser, gap before drop
 16-24 DROP     : sub boom, reese + supersaw stabs, open hats, crash every 4 bars
 24-28 boundary : breath (no reese) 2 bars, then 2-bar build back
 28-32 logo     : final drop with lead, big end chord at bar 32 (60 s)
"""
import sys
import numpy as np
sys.path.insert(0, '/Users/mac/projects/octos-promo/engine')
from synthlib import *

BPM = 128
B = 60 / BPM
BAR = 4 * B
S16 = B / 4
DUR = 62.5
m = Mix(dur=DUR)
rng = np.random.default_rng(42)

def bt(bar, beat=0.0):
    return bar * BAR + beat * B

# chords: Fm Db Ab Eb
CH = [[53, 56, 60], [53, 56, 61], [51, 56, 60], [51, 55, 58]]
ROOT = [41, 37, 44, 39]
ARPN = [[65, 68, 72, 77], [65, 68, 73, 77], [63, 68, 72, 75], [63, 67, 70, 75]]

kicks = []

def kick_at(t, g=1.0):
    kicks.append(t)
    m.add(kick(), t, gain=0.95 * g, bus='drums')

# ---------------- pads ----------------
for bar in range(0, 32):
    c = CH[bar % 4]
    if bar < 4:
        cut, g = 500 + bar * 250, 0.20 + bar * 0.04
    elif bar < 12:
        cut, g = 1400, 0.22
    elif bar < 16:
        cut, g = 1400 + (bar - 12) * 700, 0.24
    elif bar < 24:
        cut, g = 3200, 0.25
    elif bar < 26:
        cut, g = 2200, 0.30
    elif bar < 28:
        cut, g = 2600, 0.26
    else:
        cut, g = 4200, 0.27
    m.add(pad(c, BAR + 0.3, cutoff=cut, attack=0.25 if bar else 1.4, release=0.4, seed=bar),
          bt(bar), gain=g, bus='music', send=0.45, width=1.0)
# end chord
m.add(pad([41 + 12, 56, 60, 65, 68], 2.6, cutoff=5000, voices=7, detune=0.3, attack=0.01, release=1.5, seed=99),
      bt(32), gain=0.55, bus='hit', send=0.7, width=1.0)

# ---------------- arp (16ths) ----------------
PAT = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 1, 3, 2]
for bar in range(0, 32):
    if 24 <= bar < 26:
        pass
    notes = ARPN[bar % 4]
    for k in range(16):
        t = bt(bar) + k * S16
        if bar < 4:
            bright = 700 + (bar * 16 + k) / 64 * 2600
            g = 0.10 + 0.05 * bar / 4
        elif bar < 12:
            bright, g = 3500, 0.12
        elif bar < 16:
            bright, g = 3500 + (bar - 12) * 1500, 0.12
        elif bar < 24 or bar >= 28:
            bright, g = 6000, 0.10
        else:
            bright, g = 2500, 0.13
        n = notes[PAT[k]] + (12 if bar >= 16 and bar < 24 and k % 8 == 7 else 0)
        acc = 1.0 if k % 4 == 0 else 0.75
        m.add(pluck(n, 0.22, bright=bright, decay=0.07), t, gain=g * acc, pan=0.35 * np.sin(k * 1.3 + bar),
              bus='music', send=0.35)

# ---------------- boot bell + sub ----------------
m.add(bell(77, 3.0), 0.02, gain=0.22, bus='music', send=0.8, pan=-0.2)
m.add(bell(84, 3.0), bt(0, 2.5), gain=0.10, bus='music', send=0.8, pan=0.3)
m.add(sub_boom(3.0, 60, 30), 0.0, gain=0.35, bus='hit')
m.add(riser(BAR, seed=3, f0=400, f1=9000), bt(3), gain=0.18, bus='fx', send=0.3)
m.add(reverse(hat(open_=True, seed=77)) * 2, bt(4) - 0.25, gain=0.25, bus='fx')

# kernel arm pings: 8 beats from bar 4
PING = [77, 80, 84, 87, 89, 92, 96, 99]
for i, n in enumerate(PING):
    m.add(bell(n - 12, 1.2), bt(4, i), gain=0.14, pan=(i / 7 - 0.5) * 1.2, bus='music', send=0.6)

# ---------------- drums ----------------
for bar in range(4, 32):
    for beat in range(4):
        t = bt(bar, beat)
        if bar == 15 and beat >= 2:
            continue  # pull the kick before the drop
        if bar == 27 and beat == 3:
            continue
        if 24 <= bar < 26 and beat in (1, 3) and False:
            continue
        kick_at(t, 1.0 if bar >= 16 else 0.72)
# final hit kick
kick_at(bt(32), 1.0)

# claps (2 & 4)
for bar in range(6, 32):
    if bar == 15:
        continue
    for beat in (1, 3):
        m.add(clap(), bt(bar, beat), gain=0.55 if bar >= 16 else 0.45, bus='drums', send=0.25, width=0.6)
        if bar >= 16:
            m.add(snare(), bt(bar, beat), gain=0.25, bus='drums', send=0.2)

# hats
for bar in range(2, 32):
    for k in range(16):
        t = bt(bar) + k * S16
        if bar < 4:
            if k % 2 == 0:
                m.add(hat(seed=5 + k), t, gain=0.05 + 0.03 * (bar - 2), pan=0.3, bus='drums')
            continue
        v = [0.9, 0.35, 0.6, 0.35][k % 4]
        if k % 4 == 2 and bar >= 8:
            m.add(hat(open_=True, seed=6), t, gain=0.12 if bar < 16 else 0.16, pan=-0.2, bus='drums', send=0.1)
        else:
            m.add(hat(seed=5 + k), t, gain=0.12 * v, pan=0.25 * np.sin(k), bus='drums')

# ride in protocol + drop
for bar in list(range(8, 15)) + list(range(16, 24)) + list(range(28, 32)):
    for beat in range(4):
        m.add(ride(seed=beat), bt(bar, beat + 0.5), gain=0.10, pan=0.4, bus='drums', send=0.15)

# crashes (noise + ride stack)
def crash(t, g=0.35):
    m.add(fft_filter(noise(2.5, int(t * 10)), lo=4000) * np.exp(-tvec(2.5) / 0.7), t, gain=g * 0.35, bus='fx', send=0.5, width=1.0)
    m.add(ride(2.0, seed=int(t)), t, gain=g, bus='fx', send=0.4)

for bar in (8, 16, 20, 28):
    crash(bt(bar), 0.45)
crash(bt(32), 0.6)

# snare rolls: bars 14-16 and 26-28
def roll(bar0, nbars, g0=0.08, g1=0.5):
    total = nbars * 16
    ev = []
    for bar in range(nbars):
        for k in range(16):
            step = bar * 16 + k
            frac = step / total
            ev.append((bt(bar0 + bar) + k * S16, frac))
            if frac > 0.75:  # 32nds at the end
                ev.append((bt(bar0 + bar) + k * S16 + S16 / 2, frac))
    for t, frac in ev:
        if frac < 0.25 and int(round((t - bt(bar0)) / S16)) % 2 == 1:
            continue
        if t > bt(bar0 + nbars) - B * 0.5:
            continue
        m.add(snare(seed=int(t * 100) % 50), t, gain=g0 + (g1 - g0) * frac ** 1.5, bus='drums', send=0.3,
              pan=0.2 * np.sin(t * 7))

roll(14, 2)
roll(26, 2, 0.08, 0.42)

# risers into drops
m.add(riser(4 * BAR - B * 0.5, seed=12, f0=250, f1=14000), bt(12), gain=0.36, bus='fx', send=0.4, width=1.0)
m.add(riser(2 * BAR - B * 0.5, seed=13, f0=300, f1=14000), bt(26), gain=0.32, bus='fx', send=0.4, width=1.0)
# rising supersaw tone in last build bar
for (b0, nb) in ((14, 2), (26, 2)):
    d = nb * BAR - B * 0.5
    f = midi(53) * 2 ** (np.linspace(0, 12, secs(d)) / 12)
    x = supersaw(f, d, 7, 0.35, seed=4)
    x = fft_filter(x, lo=300, hi=6000) * np.linspace(0, 1, secs(d)) ** 2
    m.add(x, bt(b0), gain=0.12, bus='fx', send=0.3, width=1.0)
# reverse swells into drops + downlifter after
for t in (bt(16), bt(28)):
    m.add(reverse(fft_filter(noise(1.0, 5), lo=2000) * np.exp(-tvec(1.0) / 0.3)), t - 1.0 - 0.01, gain=0.15, bus='fx')
    m.add(sub_boom(2.5, 75, 30), t, gain=0.75, bus='hit')
    m.add(downlifter(2.5), t, gain=0.18, bus='fx', send=0.4, width=1.0)
m.add(sub_boom(3.0, 70, 28), bt(32), gain=0.9, bus='hit')
m.add(downlifter(3.0), bt(32), gain=0.2, bus='fx', send=0.5, width=1.0)

# ---------------- bass ----------------
for bar in range(4, 32):
    r = ROOT[bar % 4]
    if bar == 15 or bar == 27:
        continue
    drop = 16 <= bar < 24 or bar >= 28
    if drop:
        # reese: long notes w/ syncopated retrigger
        for (st, ln, oct_) in ((0, 1.5, 0), (1.5, 1.0, 0), (2.5, 0.75, 12), (3.25, 0.75, 0)):
            m.add(reese(r + oct_, ln * B + 0.02, cutoff=900 if oct_ == 0 else 1300), bt(bar, st), gain=0.34, bus='bass')
            m.add(sine(midi(r - 12), ln * B) * adsr(secs(ln * B), 0.005, 0.1, 0.9, 0.03), bt(bar, st), gain=0.45, bus='bass')
    else:
        cut = 700 if bar < 12 else 700 + (bar - 12) * 250
        if 24 <= bar < 26:
            cut = 500
        for beat in range(4):
            m.add(bass(r, B * 0.45, cutoff=cut, sub=0.8), bt(bar, beat + 0.5), gain=0.30, bus='bass')
            if bar >= 8 and not (24 <= bar < 26):
                m.add(bass(r + 12, B * 0.2, cutoff=cut * 1.3, sub=0.3), bt(bar, beat + 0.75), gain=0.13, bus='bass')

# ---------------- drop stabs + lead ----------------
for bar in list(range(16, 24)) + list(range(28, 32)):
    c = CH[bar % 4]
    for st in (0.5, 1.5, 2.5, 3.0, 3.5):
        notes = [n + 12 for n in c] + [c[0] + 24]
        x = pad(notes, B * 0.45, cutoff=5200, voices=7, detune=0.28, attack=0.003, release=0.08, seed=int(st * 4))
        m.add(x, bt(bar, st), gain=0.34, bus='music', send=0.3, width=1.0)

LEAD = [(0, 77, 1.5), (1.5, 75, 0.5), (2, 72, 1.0), (3, 80, 1.0)]
LEAD2 = [(0, 77, 1.0), (1, 80, 1.0), (2, 84, 1.0), (3, 82, 1.0)]
for bar in range(28, 32):
    seq = LEAD if bar % 2 == 0 else LEAD2
    shift = [0, -4, 3, -2][bar % 4]
    for st, n, ln in seq:
        d = ln * B
        x = supersaw(midi(n + shift), d, 5, 0.18, seed=bar) + 0.5 * square(midi(n + shift - 12), d)
        x = fft_filter(x, lo=250, hi=5000) * adsr(secs(d), 0.01, 0.2, 0.8, 0.06)
        m.add(x, bt(bar, st), gain=0.13, bus='music', send=0.4, width=0.8)

# packet blips in protocol / crates (seeded rhythm, high square blips)
for bar in range(8, 15):
    for k in range(16):
        if rng.random() < 0.28:
            n = ARPN[bar % 4][rng.integers(0, 4)] + 24
            d = 0.05
            x = square(midi(n), d, pw=0.3) * perc(secs(d), 0.001, 0.015)
            m.add(fft_filter(x, lo=1500, hi=9000), bt(bar) + k * S16, gain=0.07, pan=rng.uniform(-0.8, 0.8), bus='music', send=0.3)

# ---------------- sidechain + render ----------------
m.sidechain([k for k in kicks if k >= bt(16) - 0.01 and k < bt(24) or k >= bt(28)], depth=0.7, release=0.28, buses=('music', 'bass'))
m.sidechain([k for k in kicks if k < bt(16) - 0.01 or bt(24) <= k < bt(28)], depth=0.45, release=0.22, buses=('music', 'bass'))
m.write('/Users/mac/projects/octos-promo/v2-wire/audio/track.wav', decay=2.6, master_gain=0.85, fade_out=(61.0, 62.4))
print('ok', len(kicks), 'kicks')
