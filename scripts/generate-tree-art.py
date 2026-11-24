"""Deterministic local SVG tree illustrations. No external assets or runtime RNG."""
from pathlib import Path
import random
import math

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'trees'
OUT.mkdir(parents=True, exist_ok=True)


def make(kind, seed):
    rng = random.Random(seed)
    parts = ['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
<defs>
  <linearGradient id="bark" x1="115" y1="80" x2="150" y2="240" gradientUnits="userSpaceOnUse"><stop stop-color="#aa8252"/><stop offset=".45" stop-color="#7c593a"/><stop offset="1" stop-color="#453827"/></linearGradient>
  <radialGradient id="ground"><stop stop-color="#739b57" stop-opacity=".65"/><stop offset="1" stop-color="#588d53" stop-opacity="0"/></radialGradient>
  <linearGradient id="pine" x1="95" y1="70" x2="190" y2="190" gradientUnits="userSpaceOnUse"><stop stop-color="#77aa63"/><stop offset=".5" stop-color="#387351"/><stop offset="1" stop-color="#20563e"/></linearGradient>
  <linearGradient id="white" x1="125" y1="150" x2="146" y2="160" gradientUnits="userSpaceOnUse"><stop stop-color="#c7c6ac"/><stop offset=".4" stop-color="#faf2d7"/><stop offset="1" stop-color="#aaa991"/></linearGradient>
</defs>
<ellipse cx="142" cy="250" rx="92" ry="17" fill="url(#ground)"/>
<path d="M77 249Q140 235 208 249Q154 262 77 249" fill="#557c42" opacity=".55"/>
''']
    # Roots and branches retain a distinct, recognisable silhouette for each tree.
    parts.append('<path d="M140 238Q123 249 105 249M142 237Q160 250 180 249M138 242L128 253" stroke="#796046" stroke-width="4" stroke-linecap="round"/>')
    if kind == 'spruce':
        parts.append('<path d="M135 247L138 35L145 35L148 247Z" fill="url(#bark)"/>')
        for y, w in [(170,91),(140,76),(110,60),(80,42),(53,24)]:
            parts.append(f'<path d="M141 {y-44}Q{141-w*.45} {y-7} {141-w} {y+25}Q104 {y+19} 141 {y+31}Q181 {y+20} {141+w} {y+25}Q{141+w*.5} {y-6} 141 {y-44}Z" fill="url(#pine)"/>')
            for j in range(24):
                x=rng.uniform(141-w*.85,141+w*.85)
                yy=y+24-abs(x-141)*.38+rng.uniform(-5,4)
                parts.append(f'<path d="M{x:.1f} {yy:.1f}l-5 3m5-3 5 3" stroke="{rng.choice(["#a3c482","#679f67","#2c6348"])}" stroke-width="1.3" opacity=".7"/>')
    else:
        if kind == 'sapling':
            trunk='M137 247Q145 207 139 155Q137 133 143 99L148 99Q144 141 147 169Q151 218 145 248Z'
            branches=[(142,180,105,137),(144,157,179,109),(142,129,118,100),(144,111,157,77)]
            clusters=[(103,129,20,19),(178,104,23,22),(117,94,20,18),(155,72,23,26)]
        elif kind == 'birch':
            trunk='M130 248Q138 174 132 77L140 54Q141 143 143 178L149 118L159 81L163 82Q149 176 145 249Z'
            branches=[(137,135,93,89),(140,111,174,65),(139,174,92,139),(149,158,191,123),(138,85,116,56)]
            clusters=[(112,63,30,29),(148,45,27,29),(177,74,31,32),(93,101,27,35),(123,113,28,37),(169,116,33,38),(188,142,23,35),(109,154,29,32)]
        elif kind == 'maple':
            trunk='M130 248Q143 208 134 150L122 101L131 97L144 140L165 100L173 104L150 158Q144 213 149 248Z'
            branches=[(139,171,89,127),(143,155,194,118),(134,135,106,80),(145,143,157,65)]
            clusters=[(88,122,34,34),(104,83,36,37),(145,62,38,36),(179,81,38,39),(198,117,31,34),(146,108,43,42),(121,141,37,32),(171,144,35,29)]
        else:
            trunk='M124 248Q140 223 129 163L108 120L118 114L141 149L164 107L175 111L150 166Q145 220 159 249Z'
            branches=[(136,179,77,138),(144,169,204,131),(133,149,105,84),(146,147,161,71),(118,130,69,111)]
            clusters=[(64,126,34,29),(83,91,39,34),(118,65,39,36),(159,58,40,34),(196,85,40,36),(217,121,30,31),(176,112,45,40),(123,108,44,42),(100,143,38,27),(167,145,39,29)]
        # Back foliage gives the crown depth, foreground leaves add texture.
        for x,y,rx,ry in clusters:
            parts.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{rng.choice(["#35653c","#3d7641","#4c8246"])}"/>')
        parts.append(f'<path d="{trunk}" fill="url(#{"white" if kind=="birch" else "bark"})"/>')
        for x1,y1,x2,y2 in branches:
            parts.append(f'<path d="M{x1} {y1}Q{(x1+x2)/2} {y2+18} {x2} {y2}" stroke="{ "#d9d4bc" if kind=="birch" else "#876746"}" stroke-width="{3 if kind=="sapling" else 5}" stroke-linecap="round"/>')
        if kind == 'birch':
            for y in range(82,241,14):
                x=135+(y-82)/30
                parts.append(f'<path d="M{x-2:.1f} {y}l5 1m-1 2h4" stroke="#5f6254" stroke-width="2" stroke-linecap="round"/>')
        colours=['#406f3d','#558b44','#6b9d4e','#83ae59','#a2c16b','#b4cd7b']
        if kind=='birch': colours=['#588047','#72964f','#91ad61','#acc477','#c4d18c']
        for cx,cy,rx,ry in clusters:
            for _ in range(65 if kind!='sapling' else 30):
                angle=rng.random()*math.tau
                r=math.sqrt(rng.random())
                x=cx+math.cos(angle)*rx*r
                y=cy+math.sin(angle)*ry*r
                size=rng.uniform(3,6) if kind!='sapling' else rng.uniform(4,7)
                colour=colours[rng.randrange(len(colours))]
                if kind=='maple':
                    parts.append(f'<path d="M{x:.1f} {y+size:.1f}l{-size:.1f} {-size:.1f}l{size*.6:.1f} -.4l-.4 {-size:.1f}l{size*.8:.1f} {size*.5:.1f}l{size*.5:.1f} {-size*.8:.1f}l.6 {size:.1f}l{size:.1f} -.4l{-size*.6:.1f} {size*1.4:.1f}Z" fill="{colour}"/>')
                else:
                    parts.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{size*.6:.1f}" ry="{size:.1f}" transform="rotate({rng.randint(-75,75)} {x:.1f} {y:.1f})" fill="{colour}"/>')
    for _ in range(25):
        x=rng.uniform(93,190); y=rng.uniform(244,253)
        parts.append(f'<path d="M{x:.1f} {y:.1f}l-2 -4m2 4 2 -5" stroke="{rng.choice(["#6a944f","#9ab36a","#487344"])}" stroke-width="1.2" stroke-linecap="round"/>')
    parts.append('</svg>')
    (OUT/f'{kind}.svg').write_text('\n'.join(parts))


for index, kind in enumerate(['sapling','birch','spruce','maple','oak']):
    make(kind, 740+index)
