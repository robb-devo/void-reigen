import json,re,subprocess
TGT={'tap':-29.5,'select':-28,'blip':-35,'clank':-31,'drill':-29,'coin':-29,'buy':-26,'no':-29,'fanfare':-23,'claim':-22,'lode':-22,'rank':-21,'build':-23,'land':-25,'launch':-25,'warp':-20}
out=subprocess.run(['python3','audio_an.py'],capture_output=True,text=True).stdout
cur={}
s=open('src/game/fx.ts').read(); m=re.search(r"export const TRIM: Record<string, number> = (\{.*?\});",s)
cur=json.loads(re.sub(r"(\w+):",r'"\1":',m.group(1))) if m.group(1)!='{}' else {}
new={}
for line in out.splitlines()[1:-1]:
    p=line.split(); n=p[0]; lu=float(p[3]); t=cur.get(n,1)*10**((TGT[n]-lu)/20); new[n]=round(min(t,16),3)
s=s.replace(m.group(0),"export const TRIM: Record<string, number> = {"+", ".join(f"{k}: {v}" for k,v in new.items())+"};")
open('src/game/fx.ts','w').write(s); print(out)
