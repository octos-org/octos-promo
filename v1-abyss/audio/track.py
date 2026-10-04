"""ABYSS — original soundtrack for the Octos promo (v1-abyss).
104 BPM, D minor, 26 bars = 60.0 s.
  bars  0-4   surface -> dive: filtered surf, drone, pad, distant bells, whale calls
  bars  4-8   abyss: heartbeat kicks, sub, slow pluck arps
  bars  8-12  anatomy: half-time drums, bass pulse, 16th arps, pad opens
  bars 12-14  build: Gm -> A, riser, snare roll, filter sweep, 1 beat of silence
  bars 14-22  DROP: sub boom, 4/4 kick, claps, supersaw chords, reese, lead hook, sidechain
  bars 22-26  outro: final impact, Dm9 swell, bells, heartbeat callback, fade
"""
import os
import sys
sys.path.insert(0, '/Users/mac/projects/octos-promo/engine')
from synthlib import *  # noqa

BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = 60.0
HERE = os.path.dirname(os.path.abspath(__file__))


def T(bar, beat=0.0):
    return bar * BAR + beat * BEAT


m = Mix(dur=DUR)
rng = np.random.default_rng(1234)

CH = {
    'Dm': [50, 53, 57, 64], 'Bb': [46, 50, 53, 57], 'F': [45, 53, 57, 60], 'C': [48, 52, 55, 62],
    'Gm': [43, 50, 55, 58], 'A': [45, 52, 57, 61], 'Dm9': [50, 53, 57, 60, 64],
}
ROOT = {'Dm': 38, 'Bb': 34, 'F': 41, 'C': 36, 'Gm': 31, 'A': 33, 'Dm9': 38}

# chord per bar
PROG = {}
for b in range(0, 8):
    PROG[b] = 'Dm' if (b // 2) % 2 == 0 else 'Bb'
for b, c in zip(range(8, 12), ['Dm', 'Bb', 'F', 'C']):
    PROG[b] = c
PROG[12], PROG[13] = 'Gm', 'A'
for b, c in zip(range(14, 22), ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A']):
    PROG[b] = c


def lead_tone(note, dur):
    x = supersaw(midi(note), dur + 0.3, voices=5, detune=0.14, seed=int(note))
    x = fft_filter(x, lo=200, hi=3800)
    x = x * adsr(len(x), 0.01, 0.25, 0.55, 0.25, hold=dur)
    return x


def crash(dur=3.0, seed=40):
    t = tvec(dur)
    x = fft_filter(noise(dur, seed), lo=3500, hi=14000)
    return x * np.exp(-t / 0.9) * 0.5


def whale(f0, f1, dur, seed=0):
    t = tvec(dur)
    f = f0 * (f1 / f0) ** (t / dur) * (1 + 0.012 * np.sin(2 * np.pi * 5.2 * t))
    x = sine(f, dur) + 0.3 * sine(f * 2.01, dur)
    x = fft_filter(x, hi=900)
    return x * adsr(len(x), dur * 0.35, 1.0, 1.0, dur * 0.5)


# ---------------------------------------------------------------- intro / surface (bars 0-4)
surf = noise(7.0, 3)
surf = sweep_lp(surf, 5000, 160, curve=0.6)
surf = fft_filter(surf, lo=60)
surf *= np.clip(tvec(7.0) / 0.8, 0, 1) * np.clip((7.0 - tvec(7.0)) / 4.0, 0, 1)
m.add(surf, at=0.0, gain=0.10, bus='fx', send=0.3, width=0.8)
# underwater "plunge" bubbles: short filtered noise blips
for k in range(40):
    at = 2.2 + rng.random() * 3.5
    d = 0.05 + rng.random() * 0.08
    f = 400 + rng.random() * 1500
    b = sine(f * (1 + 2 * tvec(d)), d) * perc(secs(d), 0.003, d / 3)
    m.add(b, at=at, gain=0.05 * rng.random(), pan=rng.random() * 2 - 1, bus='fx', send=0.5)

# drone: D1+D2 sine, whole piece except drop section keeps it lower
drone_d = T(14)
dr = sine(midi(26), drone_d) * 0.8 + sine(midi(38), drone_d) * 0.35 + 0.15 * tri(midi(45), drone_d)
dr = fft_filter(dr, hi=400) * adsr(secs(drone_d), 3.0, 1.0, 1.0, 1.0)
m.add(dr, at=0.0, gain=0.11, bus='bass')

# pads (bars 0-12): 2-bar chords, slow attack, dark
for b in range(0, 8, 2):
    c = PROG[b]
    cut = 600 + 150 * b
    m.add(pad(CH[c], 2 * BAR + 0.8, cutoff=cut, voices=5, detune=0.18, attack=1.2, release=0.8, seed=b),
          at=T(b), gain=0.15, bus='music', send=0.55, width=0.6)
for b in range(8, 12):
    c = PROG[b]
    m.add(pad(CH[c], BAR + 0.4, cutoff=1400 + 150 * (b - 8), voices=6, detune=0.22, attack=0.25, release=0.4, seed=b),
          at=T(b), gain=0.24, bus='music', send=0.5, width=0.6)

# distant bells
BELLS = [(0, 2, 81), (1, 0, 77), (1, 2.5, 76), (2, 0, 74), (2, 3, 77), (3, 1.5, 81), (3, 3, 84),
         (4, 2, 81), (5, 0, 77), (5, 2.5, 76), (6, 0, 74), (6, 2, 72), (7, 1, 74), (7, 3, 77)]
for i, (b, bt, n) in enumerate(BELLS):
    m.add(bell(n, 2.5), at=T(b, bt), gain=0.10, pan=(-0.5 if i % 2 else 0.5), bus='music', send=0.85)

# whale calls
m.add(whale(220, 150, 3.2), at=T(1, 1), gain=0.10, pan=-0.6, bus='fx', send=0.9)
m.add(whale(196, 262, 2.6), at=T(3, 0), gain=0.07, pan=0.6, bus='fx', send=0.9)
m.add(whale(165, 110, 3.6), at=T(5, 2), gain=0.07, pan=-0.3, bus='fx', send=0.9)

# ---------------------------------------------------------------- abyss (bars 4-8)
KICKS = []  # (time, gain)
heart = lambda: fft_filter(kick(0.5, f_hi=110, f_lo=42, decay=0.3, click=0.05, drive=1.3), hi=1800)
for b in range(4, 8):
    for bt in (0, 2):
        KICKS.append((T(b, bt), 0.55, 'heart'))
        KICKS.append((T(b, bt + 0.4), 0.30, 'heart'))
# pluck arps from bar 6 (8ths)
for b in range(6, 8):
    notes = [n + 12 for n in CH[PROG[b]]]
    for k in range(8):
        n = notes[[0, 1, 2, 3, 2, 1, 2, 3][k]]
        m.add(pluck(n, 0.4, bright=1500 + 300 * k, decay=0.18), at=T(b, k * 0.5), gain=0.07,
              pan=0.4 * np.sin(k), bus='music', send=0.6)
# sub notes
for b in range(4, 8, 2):
    s = sine(midi(ROOT[PROG[b]]), 2 * BAR) * adsr(secs(2 * BAR), 0.3, 1, 1, 0.5)
    m.add(s, at=T(b), gain=0.10, bus='bass')

# ---------------------------------------------------------------- anatomy (bars 8-12)
for b in range(8, 12):
    KICKS.append((T(b, 0), 0.65, 'kick'))
    KICKS.append((T(b, 2), 0.65, 'kick'))
    KICKS.append((T(b, 2.75), 0.35, 'kick'))
    for k in range(8):
        m.add(hat(open_=False, seed=5 + k), at=T(b, k * 0.5 + 0.5 * 0), gain=0.05 if k % 2 == 0 else 0.10,
              pan=0.3, bus='drums')
    if b >= 10:
        for bt in (1, 3):
            m.add(clap(), at=T(b, bt), gain=0.25, bus='drums', send=0.35)
    # 16th arp
    notes = [n + 12 for n in CH[PROG[b]]]
    for k in range(16):
        n = notes[[0, 2, 1, 3][k % 4]] + (12 if k in (6, 14) else 0)
        m.add(pluck(n, 0.25, bright=2200 + 120 * (b - 8) * 4, decay=0.09), at=T(b, k * 0.25), gain=0.08,
              pan=0.5 * np.sin(k * 1.3), bus='music', send=0.4)
    # bass 8ths
    for k in range(8):
        m.add(bass(ROOT[PROG[b]], BEAT * 0.45, cutoff=500 + 50 * k, sub=0.8), at=T(b, k * 0.5), gain=0.2, bus='bass')

# ---------------------------------------------------------------- build (bars 12-14)
bd = T(14) - T(12)
bp = pad(CH['Gm'], BAR + 0.1, cutoff=6000, voices=7, detune=0.25, attack=0.05, release=0.1, seed=50)
bp2 = pad(CH['A'], BAR * 0.75, cutoff=6000, voices=7, detune=0.25, attack=0.05, release=0.05, seed=51)
build = np.zeros(secs(bd))
build[:len(bp)] += bp[:len(build)]
i1 = secs(BAR)
build[i1:i1 + len(bp2)] += bp2[: len(build) - i1]
build = sweep_lp(build, 400, 6000, curve=1.6, res=0.6)
m.add(build, at=T(12), gain=0.22, bus='music', send=0.4, width=0.7)
m.add(riser(bd - BEAT * 0.2, seed=7, f0=300, f1=14000), at=T(12), gain=0.28, bus='fx', send=0.3, width=1.0)
# rising tone
t_ = tvec(bd)
up = saw(midi(45) * 2 ** (2 * t_ / bd), bd)
up = fft_filter(up, hi=3000) * (t_ / bd) ** 2
m.add(up, at=T(12), gain=0.06, bus='fx', send=0.4)
for bt in range(4):
    KICKS.append((T(12, bt), 0.85, 'kick'))
for bt in (0, 0.5, 1, 1.5, 2, 2.5):
    KICKS.append((T(13, bt), 0.8, 'kick'))
snr = []
for bt in range(4):
    snr.append(T(12, bt))
for k in range(4):
    snr.append(T(13, k * 0.5))
for k in range(4):
    snr.append(T(13, 2 + k * 0.25))
for i, s in enumerate(snr):
    m.add(snare(), at=s, gain=0.12 + 0.25 * i / len(snr), bus='drums', send=0.3)
for b in (12, 13):
    for k in range(8 if b == 12 else 6):
        m.add(bass(ROOT[PROG[b]], BEAT * 0.4, cutoff=700, sub=0.8), at=T(b, k * 0.5), gain=0.26, bus='bass')
# reversed crash sucking into the drop
rc = reverse(crash(2.2, 44))
m.add(rc, at=T(14) - len(rc) / SR, gain=0.5, bus='fx', send=0.5)

# ---------------------------------------------------------------- DROP (bars 14-22)
DROP = T(14)
m.add(sub_boom(3.2, 75, 30), at=DROP, gain=1.0, bus='impact')
m.add(crash(3.5, 41), at=DROP, gain=0.8, bus='drums', send=0.6, width=1.0)
m.add(sub_boom(2.2, 70, 34), at=T(18), gain=0.65, bus='impact')
m.add(crash(2.5, 42), at=T(18), gain=0.5, bus='drums', send=0.6, width=1.0)
for b in range(14, 22):
    c = PROG[b]
    for bt in range(4):
        KICKS.append((T(b, bt), 1.0, 'kick'))
    for bt in (1, 3):
        m.add(clap(), at=T(b, bt), gain=0.5, bus='drums', send=0.3)
        m.add(snare(), at=T(b, bt), gain=0.18, bus='drums')
    for k in range(16):
        if k % 4 == 0:
            continue
        m.add(hat(seed=9 + k), at=T(b, k * 0.25), gain=0.14 if k % 2 == 0 else 0.07, pan=0.35, bus='drums')
    for bt in (0.5, 1.5, 2.5, 3.5):
        m.add(hat(open_=True, seed=31), at=T(b, bt), gain=0.06, pan=-0.3, bus='drums', send=0.2)
    if b >= 18:
        for bt in range(4):
            m.add(ride(), at=T(b, bt), gain=0.12, pan=-0.4, bus='drums', send=0.2)
    # big supersaw chord
    sp = pad([n + 12 for n in CH[c]] + [CH[c][0]], BAR + 0.3, cutoff=5200, voices=7, detune=0.3, attack=0.01, release=0.3, seed=60 + b)
    m.add(sp, at=T(b), gain=0.40, bus='music', send=0.35, width=0.9)
    # reese bass, 8th pulse on root
    m.add(reese(ROOT[c], BAR, cutoff=900), at=T(b), gain=0.30, bus='bass')
    for k in range(8):
        m.add(bass(ROOT[c] - 12, BEAT * 0.45, cutoff=200, sub=-1.0), at=T(b, k * 0.5), gain=0.25, bus='bass')

# lead hook: 2-bar phrases
PH = {
    'A': [(0, 74, 1), (1, 77, 0.5), (1.5, 81, 1.5), (3, 79, 1)],
    'B': [(0, 77, 1.5), (1.5, 76, 0.5), (2, 74, 2)],
    'C': [(0, 72, 1), (1, 76, 0.5), (1.5, 79, 1.5), (3, 77, 1)],
    'D': [(0, 76, 1.5), (1.5, 74, 0.5), (2, 72, 2)],
    'E': [(0, 73, 1), (1, 76, 0.5), (1.5, 81, 1.5), (3, 79, 0.5), (3.5, 76, 0.5)],
}
for b, ph in zip(range(14, 22), ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'E']):
    for bt, n, d in PH[ph]:
        m.add(lead_tone(n, d * BEAT), at=T(b, bt), gain=0.16, bus='lead', send=0.45, width=0.5)
        if b >= 18:
            m.add(bell(n + 12, 1.2), at=T(b, bt), gain=0.05, bus='lead', send=0.6)
# fill into outro
for k in range(8):
    m.add(snare(), at=T(21, 2 + k * 0.25), gain=0.15 + 0.03 * k, bus='drums', send=0.3)
m.add(riser(BAR, seed=9, f0=500, f1=10000), at=T(21), gain=0.22, bus='fx', send=0.3)

# ---------------------------------------------------------------- outro (bars 22-26)
OUT = T(22)
m.add(sub_boom(4.0, 80, 28), at=OUT, gain=1.0, bus='impact')
m.add(crash(4.5, 43), at=OUT, gain=0.7, bus='drums', send=0.8, width=1.0)
KICKS.append((OUT, 1.0, 'kick'))
fin_d = DUR - OUT
fin = pad([n + 12 for n in CH['Dm9']] + [50, 38 + 12], fin_d, cutoff=4000, voices=7, detune=0.28, attack=0.02, release=2.0, seed=90)
fin = sweep_lp(fin, 5000, 500, curve=0.7)
m.add(fin, at=OUT, gain=0.42, bus='music', send=0.7, width=0.9)
dr2 = sine(midi(26), fin_d) * 0.8 + sine(midi(38), fin_d) * 0.4
m.add(fft_filter(dr2, hi=300) * adsr(secs(fin_d), 0.05, 1, 1, 3.0), at=OUT, gain=0.35, bus='bass')
for i, (bt, n) in enumerate([(1, 74), (1.5, 77), (2, 81), (3, 79), (5, 77), (5.5, 76), (6, 74), (9, 81), (10, 86), (13, 74)]):
    m.add(bell(n, 3.0), at=T(22, bt), gain=0.10, pan=(-0.4 if i % 2 else 0.4), bus='music', send=0.9)
for b in (23, 24):
    for bt in (0, 2):
        KICKS.append((T(b, bt), 0.4, 'heart'))
        KICKS.append((T(b, bt + 0.4), 0.22, 'heart'))

# ---------------------------------------------------------------- drums out
k_main = kick(0.5, f_hi=170, f_lo=45, decay=0.3, click=0.3, drive=1.8)
for t0, g, kind in KICKS:
    m.add(heart() if kind == 'heart' else k_main, at=t0, gain=g, bus='drums')

m.sidechain([t for t, g, k in KICKS if k == 'kick' and t >= T(8)], depth=0.6, release=0.28, buses=('music', 'bass', 'lead'))

# bus balance
for name, g in {'drums': 1.0, 'music': 1.0, 'bass': 1.0, 'lead': 1.0, 'fx': 1.0, 'impact': 1.0}.items():
    if name in m.bus:
        m.bus[name] *= g

m.write(os.path.join(HERE, 'track.wav'), decay=3.2, master_gain=1.05, fade_out=(56.8, 60.0))
print('kicks', len(KICKS), 'drop at', DROP)
