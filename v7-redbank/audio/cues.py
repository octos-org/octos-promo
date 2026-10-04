"""Shared timeline for COSMOS (v4). Imported by track.py; also written to ../cues.json for video.js.
96 BPM, 4/4, bar = 2.5 s, 24 bars = 60 s.
"""
import json
import os

BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = 60.0


def T(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def B(beats):
    return beats * BEAT


def build():
    picks = []  # {t, kind, n}
    # game: bar 6-10, slow -> quarter -> eighth
    for b in (24, 26):
        picks.append((b, 'obs', 1))
    for b in range(28, 32):
        picks.append((b, 'obs', 1))
    for k in range(16):
        picks.append((32 + k * 0.5, 'obs', 1))
    # weather: bar 10-12, fewer, clear gaps only
    for b in (40, 42, 44, 45.5, 47):
        picks.append((b, 'obs', 1))
    waits = [B(41), B(43), B(46)]
    # ToO: alarm bar 12 beats 0..2, three request tiles
    for b in (50, 51, 52):
        picks.append((b, 'too', 1))
    # the tile that turns out to be a nova
    picks.append((54, 'obs', 1))
    # time-lapse: bars 15-17, 16ths, 3 tiles each
    for k in range(32):
        picks.append((60 + k * 0.25, 'fast', 3))
    picks = [{'t': round(B(b), 6), 'beat': b, 'kind': k, 'n': n} for b, k, n in picks]

    kicks = []  # (t, gain, kind)
    for bar in range(6, 10):
        kicks += [(T(bar, 0), 0.7, 'soft'), (T(bar, 2), 0.55, 'soft')]
        if bar >= 8:
            kicks.append((T(bar, 2.75), 0.3, 'soft'))
    for bar in (10, 11):
        kicks.append((T(bar, 0), 0.5, 'soft'))
    kicks.append((T(12, 0), 0.9, 'kick'))
    kicks += [(T(13, 0), 0.7, 'soft'), (T(13, 2), 0.6, 'soft')]
    kicks.append((T(14, 0), 1.0, 'kick'))
    for bar in (15, 16):
        for bt in range(4):
            kicks.append((T(bar, bt), 1.0, 'kick'))
    for bar in (17, 18):
        kicks += [(T(bar, 0), 0.8, 'kick'), (T(bar, 2.5), 0.5, 'kick')]
    for bt in range(4):
        kicks.append((T(19, bt), 0.85, 'kick'))
    kicks += [(T(19, 2.5), 0.6, 'kick'), (T(19, 3.5), 0.6, 'kick')]
    kicks.append((T(20, 0), 1.0, 'kick'))
    kicks.sort()

    alarm = [T(12, k * 0.5) for k in range(6)]
    return {
        'bpm': BPM, 'beat': BEAT, 'bar': BAR, 'dur': DUR,
        'picks': picks, 'waits': waits,
        'kicks': [[round(t, 6), g, k] for t, g, k in kicks],
        'alarm': [round(t, 6) for t in alarm],
        'dome': T(2, 0), 'lift1': T(4), 'too': T(12), 'toodone': B(52.5), 'nova': T(14), 'report': T(14, 2),
        'fast': T(15), 'formal': T(17), 'build': T(19), 'lift2': T(20),
        'bells': [round(T(b, bt), 6) for b, bt in [(0, 2), (1, 1), (1, 3), (2, 2), (3, 0.5), (3, 2)]],
    }


CUES = build()

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, '..', 'cues.json'), 'w') as f:
        json.dump(CUES, f, indent=1)
    print('picks', len(CUES['picks']), 'kicks', len(CUES['kicks']))
