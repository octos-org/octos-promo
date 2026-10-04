"""Small numpy synth for the Octos promo soundtracks.

Usage (in vX/audio/track.py):
    import sys; sys.path.insert(0, '../../engine')  # or absolute path
    from synthlib import *
    m = Mix(dur=63.0)
    m.add(kick(), at=0.0, gain=0.9, bus='drums')
    m.add(pad([57, 60, 64], 1.875), at=0.0, gain=0.3, pan=0.0, bus='music', send=0.4)
    m.sidechain(times=[...kick times...], depth=0.6, release=0.25, buses=('music', 'bass'))
    m.write('track.wav')

Everything returns mono float arrays at SR; pan/stereo happens in Mix.add.
Filters are FFT-based (static) or block-STFT (sweeps), so long signals are fast.
"""
import numpy as np
import wave

SR = 48000


def midi(n):
    return 440.0 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)


def secs(n):
    return int(round(n * SR))


def tvec(dur):
    return np.arange(secs(dur)) / SR


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, hold=None):
    """Envelope of length n samples. hold = time before release (defaults to n - r)."""
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip(1 - (t - hold) / max(r, 1e-6), 0, 1)
    return e * np.where(t > hold, rel, 1.0)


def perc(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-6)) * np.exp(-t / d)


# ---------- oscillators (polyBLEP saw / square to keep aliasing down) ----------
def _blep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m]
    out[m] = x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt[m2]
    out[m2] = x * x + x + x + 1
    return out


def phase(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return (ph0 + np.cumsum(f) / SR) % 1.0, f / SR


def saw(freq, dur, ph0=0.0):
    n = secs(dur)
    ph, dt = phase(freq, n, ph0)
    return 2 * ph - 1 - _blep(ph, dt)


def square(freq, dur, ph0=0.0, pw=0.5):
    n = secs(dur)
    ph, dt = phase(freq, n, ph0)
    s = np.where(ph < pw, 1.0, -1.0)
    s += _blep(ph, dt)
    s -= _blep((ph + 1 - pw) % 1.0, dt)
    return s


def sine(freq, dur, ph0=0.0):
    n = secs(dur)
    ph, _ = phase(freq, n, ph0)
    return np.sin(2 * np.pi * ph)


def tri(freq, dur, ph0=0.0):
    n = secs(dur)
    ph, _ = phase(freq, n, ph0)
    return 1 - 4 * np.abs(ph - 0.5)


def noise(dur, seed=0):
    return np.random.default_rng(seed).standard_normal(secs(dur))


def supersaw(freq, dur, voices=7, detune=0.25, seed=0):
    """Detuned saw stack (detune in semitones, total spread)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(secs(dur))
    for v in range(voices):
        d = (v / (voices - 1) - 0.5) * detune if voices > 1 else 0
        out += saw(freq * 2 ** (d / 12), dur, rng.random())
    return out / np.sqrt(voices)


# ---------- filters ----------
def fft_filter(x, lo=None, hi=None, slope=2.0):
    """Static high-pass (lo) / low-pass (hi) in Hz, soft Butterworth-like magnitude."""
    n = len(x)
    if n == 0:
        return x
    N = 1 << int(np.ceil(np.log2(n + SR // 10)))
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * slope))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * slope))
    return np.fft.irfft(X * g, N)[:n]


def sweep_lp(x, f0, f1, curve=1.0, res=0.0, block=1024):
    """Time-varying low-pass from f0 to f1 Hz (exponential), via windowed STFT overlap-add.
    res > 0 adds a resonant bump at the cutoff."""
    n = len(x)
    hop = block // 2
    win = np.hanning(block + 1)[:-1]
    out = np.zeros(n + block)
    xp = np.concatenate([x, np.zeros(block)])
    f = np.fft.rfftfreq(block, 1 / SR)
    for i in range(0, n, hop):
        p = (i / max(1, n)) ** curve
        fc = f0 * (f1 / f0) ** p
        g = 1 / np.sqrt(1 + (f / fc) ** 8)
        if res:
            g += res * np.exp(-((f - fc) / (fc * 0.15)) ** 2)
        seg = np.fft.irfft(np.fft.rfft(xp[i:i + block] * win) * g, block)
        out[i:i + block] += seg
    return out[:n]


# ---------- instruments ----------
def kick(dur=0.45, f_hi=160, f_lo=46, pitch_decay=0.035, decay=0.28, click=0.25, drive=1.6):
    t = tvec(dur)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / pitch_decay)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    c = fft_filter(noise(dur, 11), lo=1500, hi=9000) * np.exp(-t / 0.004) * click
    return np.tanh((body + c) * drive) / np.tanh(drive)


def sub_boom(dur=2.5, f0=70, f1=32):
    """Cinematic impact: pitch-dropping sub with long tail."""
    t = tvec(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.8))


def clap(dur=0.35, seed=3):
    t = tvec(dur)
    n = fft_filter(noise(dur, seed), lo=800, hi=6000)
    e = np.zeros_like(t)
    for k, off in enumerate([0, 0.011, 0.023]):
        e += (t >= off) * np.exp(-np.maximum(0, t - off) / (0.008 if k < 2 else 0.09))
    return n * e * 0.6


def snare(dur=0.3, seed=4):
    t = tvec(dur)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    n = fft_filter(noise(dur, seed), lo=1200, hi=10000) * np.exp(-t / 0.08)
    return 0.6 * body + 0.8 * n


def hat(dur=0.08, open_=False, seed=5):
    d = 0.25 if open_ else dur
    t = tvec(d)
    n = fft_filter(noise(d, seed), lo=7000)
    return n * np.exp(-t / (0.09 if open_ else 0.018))


def ride(dur=0.9, seed=6):
    t = tvec(dur)
    metal = sum(square(f, dur) for f in (3460, 4110, 5235, 6380)) * 0.2
    return fft_filter(metal + 0.5 * noise(dur, seed), lo=5000) * np.exp(-t / 0.35) * 0.4


def pluck(note, dur=0.3, bright=4000, decay=0.12, kind='saw'):
    osc = saw if kind == 'saw' else square
    x = osc(midi(note), dur) + 0.5 * osc(midi(note) * 1.003, dur)
    x = sweep_lp(x, bright, 300, curve=0.5)
    return x * perc(len(x), 0.002, decay)


def bell(note, dur=1.5):
    """FM bell."""
    t = tvec(dur)
    f = midi(note)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.5 * np.exp(-t / 0.4)
    return np.sin(2 * np.pi * f * t + mod) * perc(len(t), 0.001, 0.6)


def pad(notes, dur, cutoff=1800, voices=5, detune=0.2, attack=0.4, release=0.5, seed=0):
    x = sum(supersaw(midi(n), dur, voices, detune, seed + i) for i, n in enumerate(notes)) / max(1, len(notes)) ** 0.5
    x = fft_filter(x, lo=120, hi=cutoff)
    return x * adsr(len(x), attack, 1.0, 1.0, release)


def bass(note, dur, cutoff=900, sub=0.7, drive=1.5):
    f = midi(note)
    x = saw(f, dur) * 0.6 + sine(f / 2 if sub < 0 else f, dur) * abs(sub)
    x = fft_filter(x, hi=cutoff)
    x = np.tanh(x * drive) / np.tanh(drive)
    return x * adsr(len(x), 0.004, 0.15, 0.8, 0.03)


def reese(note, dur, cutoff=700):
    f = midi(note)
    x = saw(f * 2 ** (-0.12 / 12), dur) + saw(f * 2 ** (0.12 / 12), dur, 0.37) + 0.8 * sine(f / 2, dur)
    return np.tanh(fft_filter(x, hi=cutoff) * 1.4) * adsr(secs(dur), 0.01, 0.2, 0.9, 0.05)


def riser(dur=4.0, seed=7, f0=300, f1=12000):
    x = noise(dur, seed)
    x = sweep_lp(x, f0, f1, curve=2.0, res=0.8)
    t = tvec(dur)
    return fft_filter(x, lo=200) * (t / dur) ** 2


def downlifter(dur=2.0, seed=8):
    x = sweep_lp(noise(dur, seed), 12000, 200, curve=0.5)
    return x * np.exp(-tvec(dur) / (dur / 3))


def reverse(x):
    return x[::-1].copy()


# ---------- mixer ----------
class Mix:
    """Stereo buses; optional reverb send; sidechain ducking; master glue."""

    def __init__(self, dur):
        self.n = secs(dur)
        self.bus = {}
        self.send = np.zeros((2, self.n))
        self.duck = {}

    def _b(self, name):
        if name not in self.bus:
            self.bus[name] = np.zeros((2, self.n))
        return self.bus[name]

    def add(self, sig, at, gain=1.0, pan=0.0, bus='main', send=0.0, width=0.0):
        """pan -1..1; width > 0 delays the right channel a few ms for stereo spread."""
        i = secs(at)
        if i >= self.n or len(sig) == 0:
            return
        s = np.asarray(sig)[: self.n - i] * gain
        gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
        gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        b = self._b(bus)
        b[0, i:i + len(s)] += s * gl
        if width:
            d = secs(width * 0.012)
            r = np.concatenate([np.zeros(d), s])[: len(s)]
            b[1, i:i + len(s)] += r * gr
        else:
            b[1, i:i + len(s)] += s * gr
        if send:
            self.send[0, i:i + len(s)] += s * gl * send
            self.send[1, i:i + len(s)] += s * gr * send

    def sidechain(self, times, depth=0.6, release=0.22, buses=('music',)):
        env = np.ones(self.n)
        t = np.arange(self.n) / SR
        for k in times:
            i = secs(k)
            if i >= self.n:
                continue
            j = min(self.n, i + secs(release * 1.5))
            x = (t[i:j] - k) / release
            env[i:j] = np.minimum(env[i:j], 1 - depth * (1 - np.clip(x, 0, 1) ** 1.5))
        for b in buses:
            self.duck[b] = self.duck.get(b, np.ones(self.n)) * env

    def reverb(self, decay=2.2, predelay=0.02, lo=250, hi=7000, seed=21):
        """Convolution with decorrelated exponentially-decaying noise (stereo)."""
        L = secs(decay * 1.6)
        t = np.arange(L) / SR
        out = np.zeros((2, self.n))
        for ch in range(2):
            ir = np.random.default_rng(seed + ch).standard_normal(L) * np.exp(-6.9 * t / decay)
            ir = fft_filter(ir, lo=lo, hi=hi)
            ir = np.concatenate([np.zeros(secs(predelay)), ir])
            N = 1 << int(np.ceil(np.log2(self.n + len(ir))))
            y = np.fft.irfft(np.fft.rfft(self.send[ch], N) * np.fft.rfft(ir, N), N)[: self.n]
            out[ch] = y / np.sqrt(np.sum(ir ** 2)) * 0.5
        return out

    def render(self, reverb=True, decay=2.2, master_gain=1.0, fade_out=None):
        out = np.zeros((2, self.n))
        for name, b in self.bus.items():
            out += b * self.duck.get(name, 1.0)
        if reverb and np.any(self.send):
            wet = self.reverb(decay)
            out += wet * self.duck.get('music', 1.0) ** 0.5
        out *= master_gain
        # glue: gentle soft clip then normalize to -1 dBFS
        out = np.tanh(out * 1.2) / 1.2
        pk = np.max(np.abs(out)) or 1.0
        out *= 0.89 / pk
        if fade_out:
            a, b = fade_out
            t = np.arange(self.n) / SR
            out *= np.clip((b - t) / (b - a), 0, 1)
        return out

    def write(self, path, **kw):
        out = self.render(**kw)
        pcm = (out.T * 32767).astype('<i2')
        with wave.open(path, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        return out
