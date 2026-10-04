import wave, numpy as np, sys
w = wave.open(sys.argv[1]); n = w.getnframes(); sr = w.getframerate()
x = np.frombuffer(w.readframes(n), '<i2').reshape(-1, 2).astype(float) / 32768
for b in range(0, int(n / sr), 2):
    s = x[b * sr:(b + 2) * sr]
    print(f"{b:2d}s rms {20*np.log10(np.sqrt((s**2).mean())+1e-9):6.1f} dB  peak {20*np.log10(np.abs(s).max()+1e-9):5.1f}")
