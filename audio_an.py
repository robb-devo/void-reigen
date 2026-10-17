import numpy as np, glob, wave, os
def lfilter(b,a,x):
    y=np.zeros_like(x); x1=x2=y1=y2=0.0
    for i,v in enumerate(x):
        o=b[0]*v+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2; x2=x1; x1=v; y2=y1; y1=o; y[i]=o
    return y
def kw(x, fs=44100):
    # K-weighting (BS.1770) approx: high-shelf + high-pass
    b1,a1=[1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,0.73248077421585]
    b2,a2=[1,-2,1],[1,-1.99004745483398,0.99007225036621]
    return lfilter(b2,a2,lfilter(b1,a1,x))
rows=[]
for f in sorted(glob.glob('audio/*.f32')):
    n=os.path.basename(f)[:-4]; x=np.fromfile(f,dtype=np.float32).astype(np.float64)
    w=wave.open(f'audio/{n}.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100); w.writeframes((np.clip(x,-1,1)*32767).astype(np.int16).tobytes()); w.close()
    nz=np.nonzero(np.abs(x)>1e-4)[0]; dur=(nz[-1]-nz[0])/44100 if len(nz) else 0
    seg=x[nz[0]:nz[-1]+1] if len(nz) else x
    k=kw(seg); blk=4410; ms=[np.mean(k[i:i+blk]**2) for i in range(0,max(1,len(k)-blk),blk)] or [np.mean(k**2)]
    lufs=-0.691+10*np.log10(max(max(ms),1e-12))  # short-term max (100ms blocks)
    peak=20*np.log10(max(np.max(np.abs(x)),1e-9)); clip=int(np.sum(np.abs(x)>=0.999))
    S=np.abs(np.fft.rfft(seg*np.hanning(len(seg))))**2; fr=np.fft.rfftfreq(len(seg),1/44100)
    cen=np.sum(fr*S)/np.sum(S); lo=np.sum(S[fr<250])/np.sum(S); hi=np.sum(S[fr>5000])/np.sum(S)
    rows.append((n,dur,peak,lufs,clip,cen,lo,hi))
print(f"{'sfx':8} {'dur':>5} {'peak':>6} {'LUmax':>6} {'clip':>4} {'centroid':>8} {'<250':>5} {'>5k':>5}")
for r in rows: print(f"{r[0]:8} {r[1]:5.2f} {r[2]:6.1f} {r[3]:6.1f} {r[4]:4d} {r[5]:8.0f} {r[6]:5.2f} {r[7]:5.2f}")
L=[r[3] for r in rows]; print('LU spread', round(max(L)-min(L),1), 'median', round(float(np.median(L)),1))
