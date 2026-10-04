# Original soundtrack for the Octos promo. 128 BPM, 32 bars, A minor.
import numpy as np, wave
SR = 48000
BPM = 128
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 32
TAIL = 3.0
N = int((BARS * BAR + TAIL) * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def midi(n): return 440 * 2 ** ((n - 69) / 12)
def add(sig, t0, gl=1.0, gr=1.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gl; R[i:i + len(sig)] += sig * gr
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def lp(x, a):  # one-pole lowpass
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a * (x[i] - s); y[i] = s
    return y
def saw(f, n, ph=0):
    t = np.arange(n) / SR
    return 2 * ((t * f + ph) % 1) - 1

# Am  F  C  G  (roots / triads)
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]

def has(bar, *ranges): return any(a <= bar < b for a, b in ranges)

for bar in range(BARS):
    t0 = bar * BAR
    root, chord = PROG[bar % 4]
    n = int(BAR * SR)
    # pad: detuned saws, filtered, always on (quieter in the drop)
    pad = np.zeros(n)
    for note in chord:
        for det, ph in ((-0.08, 0.1), (0.08, 0.6)):
            pad += saw(midi(note + 12) * 2 ** (det / 12), n, ph)
    pad = lp(pad, 0.035 if bar < 16 else 0.06) * 0.05
    fade = np.minimum(1, np.arange(n) / (0.15 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.15 * SR))
    add(pad * fade, t0, 1.0, 0.9)
    # bass: 8ths, from bar 8
    if has(bar, (8, 28)):
        for k in range(8):
            m = int(BEAT / 2 * SR)
            s = lp(saw(midi(root - 12), m), 0.08) * env(m, 0.003, 0.18) * 0.32
            add(s, t0 + k * BEAT / 2)
    # kick: 4 on the floor bars 4-27, half-time in outro
    if has(bar, (4, 28)) or (bar == 28):
        for k in range(4):
            m = int(0.35 * SR); t = np.arange(m) / SR
            f = 45 + 110 * np.exp(-t / 0.03)
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * 0.8
            add(s, t0 + k * BEAT)
    # clap on 2 and 4 in the drop
    if has(bar, (16, 28)):
        for k in (1, 3):
            m = int(0.2 * SR)
            s = lp(rng.standard_normal(m), 0.35) * env(m, 0.001, 0.05) * 0.25
            add(s, t0 + k * BEAT, 0.9, 1.0)
    # hats on offbeats from bar 2
    if has(bar, (2, 28)):
        for k in range(4):
            m = int(0.06 * SR)
            x = rng.standard_normal(m); x = x - lp(x, 0.4)
            add(x * env(m, 0.001, 0.015) * 0.18, t0 + k * BEAT + BEAT / 2, 0.8, 1.0)
    # arp: 16ths from bar 8, pluck squares
    if has(bar, (8, 28)):
        pat = [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1]
        for k in range(16):
            note = chord[pat[k]] + 24
            m = int(BEAT / 4 * SR * 1.5)
            t = np.arange(m) / SR
            sq = np.sign(np.sin(2 * np.pi * midi(note) * t))
            s = lp(sq, 0.12) * env(m, 0.002, 0.07) * (0.07 if bar < 16 else 0.09)
            pan = 0.5 + 0.4 * np.sin(k * 0.8)
            add(s, t0 + k * BEAT / 4, 1 - pan * 0.6, 0.4 + pan * 0.6)
    # riser into the drop (bar 15) and into the outro (bar 27)
    if bar in (15, 27):
        m = n; t = np.arange(m) / SR
        x = rng.standard_normal(m)
        a = 0.01 + 0.4 * (t / BAR) ** 2
        y = np.empty(m); s = 0.0
        for i in range(m):
            s += a[i] * (x[i] - s); y[i] = s
        add(y * (t / BAR) ** 2 * 0.35, t0)

# final chord ring in the outro
m = int(4 * SR); t = np.arange(m) / SR
ring = sum(np.sin(2 * np.pi * midi(nn) * t) for nn in (57, 64, 69, 72)) * np.exp(-t / 1.4) * 0.08
add(ring, 28 * BAR + 2 * BAR)

# sidechain pump against the kick
t = np.arange(N) / SR
ph = (t % BEAT) / BEAT
pump = np.where((t >= 4 * BAR) & (t < 28 * BAR), 0.45 + 0.55 * np.minimum(1, ph / 0.35), 1.0)
L *= pump; R *= pump
peak = max(np.abs(L).max(), np.abs(R).max())
L /= peak / 0.89; R /= peak / 0.89
out = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open('audio/octos.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok', N / SR, 's')
