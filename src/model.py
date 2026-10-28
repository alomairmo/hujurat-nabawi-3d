import bpy
import math
import os
import random
from collections import defaultdict
from mathutils import Vector

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public', 'models'))
os.makedirs(OUT, exist_ok=True)
random.seed(622)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

MATERIALS = {
    'mud': (0.48, 0.30, 0.16), 'mud_light': (0.60, 0.41, 0.24),
    'mud_dark': (0.38, 0.23, 0.12), 'mortar': (0.43, 0.28, 0.16),
    'sand': (0.64, 0.48, 0.29), 'earth': (0.50, 0.36, 0.21),
    'palm': (0.25, 0.14, 0.065), 'palm_light': (0.37, 0.25, 0.105),
    'leaf': (0.20, 0.28, 0.12), 'wood': (0.22, 0.12, 0.055),
    'leather': (0.24, 0.105, 0.045), 'leather_edge': (0.40, 0.20, 0.075),
    'woven': (0.53, 0.37, 0.16), 'woven_light': (0.66, 0.49, 0.24),
    'rope': (0.44, 0.31, 0.14), 'clay': (0.43, 0.18, 0.085),
    'sant': (0.24, 0.27, 0.10), 'shadow': (0.055, 0.038, 0.025),
    'fabric_red': (0.29, 0.045, 0.065), 'fabric_dark': (0.028, 0.022, 0.018),
    'fabric_cream': (0.76, 0.66, 0.45), 'shell': (0.84, 0.77, 0.61),
    'grave_earth': (0.40, 0.27, 0.15), 'door': (0.18, 0.085, 0.038),
}
MATS = {}
for name, color in MATERIALS.items():
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    MATS[name] = m

class Builder:
    def __init__(self):
        self.v, self.f, self.mi = [], [], []
    def add(self, verts, faces, mat):
        n = len(self.v)
        self.v.extend([tuple(v) for v in verts])
        self.f.extend([tuple(n+i for i in f) for f in faces])
        self.mi.extend([mat]*len(faces))
    def box(self, loc, size, mat):
        x,y,z = loc; a,b,c = [s/2 for s in size]
        vs = [(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
              (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
        self.add(vs, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)
    def cylinder(self, a, b, r, mat, sides=10, r2=None):
        a,b = Vector(a),Vector(b); d=(b-a).normalized()
        q = d.to_track_quat('Z','Y'); r2 = r if r2 is None else r2
        vs=[]
        for p,rad in ((a,r),(b,r2)):
            for i in range(sides):
                ang=i*math.tau/sides
                vs.append(p+q@Vector((rad*math.cos(ang),rad*math.sin(ang),0)))
        fs=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
        fs += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
        self.add(vs,fs,mat)
    def sphere(self, loc, scale, mat, seg=12, rings=6):
        x,y,z=loc; sx,sy,sz=scale; vs=[]
        for j in range(rings+1):
            phi=math.pi*j/rings
            for i in range(seg):
                th=math.tau*i/seg
                vs.append((x+sx*math.sin(phi)*math.cos(th),y+sy*math.sin(phi)*math.sin(th),z+sz*math.cos(phi)))
        fs=[]
        for j in range(rings):
            for i in range(seg):
                n=(i+1)%seg
                fs.append((j*seg+i,j*seg+n,(j+1)*seg+n,(j+1)*seg+i))
        self.add(vs,fs,mat)
    def torus(self, loc, major, minor, mat, axis='Z', seg=16, tube=6):
        x,y,z=loc; vs=[]
        for i in range(seg):
            a=math.tau*i/seg
            for j in range(tube):
                b=math.tau*j/tube
                p=Vector(((major+minor*math.cos(b))*math.cos(a),(major+minor*math.cos(b))*math.sin(a),minor*math.sin(b)))
                if axis=='X': p=Vector((p.z,p.x,p.y))
                if axis=='Y': p=Vector((p.x,p.z,p.y))
                vs.append((x+p.x,y+p.y,z+p.z))
        fs=[]
        for i in range(seg):
            for j in range(tube):
                fs.append((i*tube+j,((i+1)%seg)*tube+j,((i+1)%seg)*tube+(j+1)%tube,i*tube+(j+1)%tube))
        self.add(vs,fs,mat)

GROUPS=defaultdict(Builder)
def B(name): return GROUPS[name]

def brick_wall(group, center, length, height, thickness, axis='X', door=None):
    x,y,z=center
    B(group).box((x,y,z+height/2),(length,thickness,height) if axis=='X' else (thickness,length,height),'mortar')
    ch=.47; rows=int(height/ch)
    for row in range(rows):
        count=max(1,int(length/1.05))
        for i in range(count):
            off=-length/2+(i+.5)*length/count+(.24 if row%2 else -.12)
            if abs(off)>length/2-.35: continue
            if door and abs(off-door[0])<door[1]/2+.35 and (row+.5)*ch<door[2]: continue
            tone=random.choices(['mud','mud_light','mud_dark'],[.62,.25,.13])[0]
            dz=random.uniform(-.025,.025)
            if axis=='X':
                loc=(x+off,y-thickness*.05,z+(row+.5)*ch+dz); size=(length/count-.035,thickness*1.10,ch-.035)
            else:
                loc=(x-thickness*.05,y+off,z+(row+.5)*ch+dz); size=(thickness*1.10,length/count-.035,ch-.035)
            B(group).box(loc,size,tone)

def palm(group,x,y,h=6):
    B(group).cylinder((x,y,0),(x,y,h),.24,'palm',12,r2=.15)
    for k in range(11):
        a=k*math.tau/11+random.uniform(-.12,.12); length=random.uniform(2.2,3.1)
        base=Vector((x,y,h)); end=base+Vector((math.cos(a)*length,math.sin(a)*length,random.uniform(-.9,.2)))
        mid=base+Vector((math.cos(a)*length*.52,math.sin(a)*length*.52,.45))
        B(group).cylinder(base,mid,.035,'palm_light',6,r2=.025); B(group).cylinder(mid,end,.025,'palm_light',6,r2=.012)
        side=Vector((-math.sin(a),math.cos(a),0))
        for j in range(1,9):
            t=j/9; p=(1-t)*mid+t*end
            for sign in (-1,1):
                e=p+side*sign*(.45*(1-t)+.12)+Vector((0,0,-.18))
                B(group).cylinder(p,e,.022,'leaf',5,r2=.008)

def palisade(group, a, b, height=1.65):
    start, end = Vector(a), Vector(b)
    length = (end-start).length
    count = max(2, int(length/.27)+1)
    for i in range(count):
        p = start.lerp(end, i/(count-1))
        h = height+random.uniform(-.14,.14)
        lean = Vector((random.uniform(-.045,.045),random.uniform(-.045,.045),0))
        B(group).cylinder(p,p+Vector((0,0,h))+lean,.045,'palm_light',6,r2=.032)
    for z in (.48,1.16):
        B(group).cylinder(start+Vector((0,0,z)),end+Vector((0,0,z)),.035,'palm',6)

def east_room(group, y):
    h = 2.70+random.uniform(-.06,.06)
    brick_wall(group,(24.4,y,0),3.6,h,.38,'Y')
    brick_wall(group,(22.2,y+1.8,0),4.4,h,.38,'X')
    brick_wall(group,(22.2,y-1.8,0),4.4,h,.38,'X')
    brick_wall(group,(20.0,y,0),3.6,h,.38,'Y',door=(0,1.05,1.92))
    B(group).box((19.78,y,.94),(.045,.91,1.88),'shadow')
    B(group).box((22.2,y,h+.06),(4.65,3.86,.22),'mud_light')
    for j in range(7):
        B(group).cylinder((19.9,y-1.62+j*.54,h-.10),(24.55,y-1.62+j*.54,h-.10),.055,'palm',6)
    for yy in (y-1.79,y+1.79):
        B(group).box((22.2,yy,h+.25),(4.58,.20,.30),'mud')
    B(group).box((24.39,y,h+.25),(.20,3.62,.30),'mud')
    B(group).box((22.2,y-3.02,.035),(4.18,2.18,.07),'earth')
    palisade(group,(20.0,y-4.22,0),(24.4,y-4.22,0))
    palisade(group,(24.4,y-4.22,0),(24.4,y-1.92,0))
    palisade(group,(20.0,y-4.22,0),(20.0,y-2.85,0))

def north_room(group, x):
    y = 21.2
    h = 2.70+random.uniform(-.06,.06)
    brick_wall(group,(x,23.1,0),5.2,h,.38,'X')
    brick_wall(group,(x-2.6,y,0),3.8,h,.38,'Y')
    brick_wall(group,(x+2.6,y,0),3.8,h,.38,'Y')
    brick_wall(group,(x,19.3,0),5.2,h,.38,'X',door=(0,1.05,1.92))
    B(group).box((x,19.08,.94),(.91,.045,1.88),'shadow')
    B(group).box((x,y,h+.06),(5.46,4.05,.22),'mud_light')
    for j in range(9):
        B(group).cylinder((x-2.42+j*.605,19.18,h-.10),(x-2.42+j*.605,23.25,h-.10),.055,'palm',6)
    for xx in (x-2.59,x+2.59):
        B(group).box((xx,y,h+.25),(.20,3.84,.30),'mud')
    B(group).box((x,23.09,h+.25),(5.24,.20,.30),'mud')
    B(group).box((x+3.66,y,.035),(1.82,3.56,.07),'earth')
    palisade(group,(x+4.58,19.35,0),(x+4.58,23.05,0))
    palisade(group,(x+2.75,23.05,0),(x+4.58,23.05,0))
    palisade(group,(x+3.70,19.35,0),(x+4.58,19.35,0))

def flush():
    for name,builder in GROUPS.items():
        mesh=bpy.data.meshes.new(name+'_mesh')
        mesh.from_pydata(builder.v,[],builder.f); mesh.update()
        obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
        used=[]
        for m in builder.mi:
            if m not in used: used.append(m)
        for m in used: mesh.materials.append(MATS[m])
        index={m:i for i,m in enumerate(used)}
        for poly,mi in zip(mesh.polygons,builder.mi):
            poly.material_index=index[mi]
            poly.use_smooth = name.startswith('item_') and any(s in name for s in ['waterskins','vessel','cushion','mattress'])
    GROUPS.clear()

def save_export(stem):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,stem+'.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,stem+'.glb'),export_format='GLB',export_cameras=False,export_lights=False)

B('scene_base').box((1.5,1.5,-.35),(64,59,.65),'sand')
B('scene_base').box((0,0,.015),(36,32,.12),'earth')
brick_wall('mosque_walls',(0,-16,0),36,4.15,.65,'X')
brick_wall('mosque_walls',(0,16,0),36,4.15,.65,'X',door=(0,2,2.5))
brick_wall('mosque_walls',(-18,0,0),32,4.15,.65,'Y',door=(0,2,2.5))
brick_wall('mosque_walls',(18,0,0),32,4.15,.65,'Y',door=(-5,1.6,2.3))
B('mosque_walls').box((0,16.34,1.2),(1.75,.05,2.4),'shadow')
B('mosque_walls').box((-18.34,0,1.2),(.05,1.75,2.4),'shadow')
for zone,y_values,roof_y,depth in [('south',[-14.7,-10.8,-6.9],-11.5,9),('north',[14.7,11.4],13.4,5.2)]:
    for y in y_values:
        for x in [-15,-11,-7,-3,1,5,9,13,16]:
            if zone=='north' and x>13: continue
            h=3.75 if zone=='south' else 3.45
            B('palm_columns').cylinder((x,y,0),(x,y,h),.19,'palm',10,r2=.15)
            B('palm_columns').torus((x,y,h-.25),.19,.035,'rope')
    z=3.95 if zone=='south' else 3.65
    B('palm_roofs').box((0,roof_y,z),(35.4,depth,.24),'palm_light')
    for i in range(44):
        x=-17.2+i*.8
        B('palm_roofs').cylinder((x,roof_y-depth/2,z-.16),(x,roof_y+depth/2,z-.16),.045,'palm',6)
    for j in range(4):
        y=roof_y-depth/2+.6+j*(depth-1.2)/3
        B('palm_roofs').cylinder((-17.4,y,z-.22),(17.4,y,z-.22),.10,'palm',8)
for i in range(3): B('minbar').box((-4.5,-14.8+i*.36,.18+i*.20),(1.25,.42,.36+i*.40),'wood')
B('minbar').cylinder((-5.05,-15,.2),(-5.05,-13.8,1.35),.055,'wood')
B('minbar').cylinder((-3.95,-15,.2),(-3.95,-13.8,1.35),.055,'wood')

for group,y in [
    ('room_sawda',-14.4),('room_aisha',-7.2),('room_hafsa',0),
    ('room_umm_salama',7.2),('room_zaynab_jahsh',14.4)
]: east_room(group,y)
for group,x in [
    ('room_zaynab_khuzayma',-12),('room_umm_habiba',-4),
    ('room_safiyya',4),('room_fatima_ali',12)
]: north_room(group,x)

for x,y,h in [(-22,13,6.2),(-24,-11,5.7),(27,18,6.5),(-17,25,5.9),(28,-18,5.8)]: palm('date_palms',x,y,h)
for i in range(42):
    x=random.uniform(-29,30); y=random.choice([random.uniform(25,28),random.uniform(-25,-20)]); s=random.uniform(.08,.22)
    B('scene_base').sphere((x,y,s*.35),(s,s*.72,s*.4),'mud_dark',8,4)
flush(); save_export('exterior')

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

B('room_architecture').box((0,0,-.12),(6.4,6.4,.24),'earth')
brick_wall('room_architecture',(0,3.05,0),6.4,2.75,.35,'X')
brick_wall('room_architecture',(-3.05,0,0),6.1,2.75,.35,'Y')
brick_wall('room_architecture',(3.05,0,0),6.1,.78,.35,'Y')
brick_wall('room_architecture',(0,-3.05,0),6.4,.78,.35,'X')
for x in (-1.18,1.18):
    B('room_architecture').box((x,-2.92,1.02),(1.02,.12,1.92),'door')
    B('room_architecture').box((x,-2.84,1.02),(.80,.035,1.68),'wood')
    for z in (.38,1.02,1.66):
        B('room_architecture').box((x,-2.81,z),(.84,.045,.065),'palm_light')
    B('room_architecture').sphere((x+.27,-2.77,1.02),(.045,.035,.045),'shell',10,6)

for group,y in [('item_grave_prophet',1.45),('item_grave_abu_bakr',0),('item_grave_umar',-1.45)]:
    B(group).box((-1.85,y,.09),(1.30,1.42,.18),'grave_earth')
    B(group).sphere((-1.85,y,.20),(.54,.63,.16),'grave_earth',18,8)
    B(group).sphere((-1.85,y+.43,.37),(.16,.13,.11),'mud_light',12,6)
    for x in (-2.48,-1.22): B(group).box((x,y,.11),(.09,1.44,.20),'mud_dark')
    for yy in (y-.70,y+.70): B(group).box((-1.85,yy,.11),(1.30,.09,.20),'mud_dark')

for x in (.84,2.26):
    for y in (-1.28,1.78): B('item_bed').cylinder((x,y,0),(x,y,.46),.075,'wood',8)
    B('item_bed').cylinder((x,-1.38,.43),(x,1.88,.43),.075,'wood',8)
for i in range(18):
    y=-1.30+i*.18
    B('item_bed').cylinder((.82,y,.44),(2.28,y,.44),.042,'palm_light',7)
B('item_mattress').box((1.55,.25,.50),(1.38,3.20,.12),'leather_edge')
B('item_bedspread').box((1.55,.25,.575),(1.40,3.23,.055),'fabric_red')
for x in (.90,2.20):
    B('item_bedspread').cylinder((x,-1.34,.61),(x,1.84,.61),.014,'fabric_cream',6)
for i in range(17):
    y=-1.25+i*.185
    B('item_bedspread').cylinder((.94,y,.612),(2.16,y,.612),.008,'woven_light',5)
for i in range(13):
    x=.94+i*.205
    B('item_bedspread').cylinder((x,-1.39,.59),(x,-1.50,.35),.012,'fabric_cream',5)
for loc,scale in [((1.55,1.46,.82),(.54,.33,.18)),((1.00,.88,.80),(.27,.43,.16)),((2.10,.88,.80),(.27,.43,.16))]:
    B('item_cushion').sphere(loc,scale,'fabric_cream',18,10)
    x,y,z=loc
    B('item_cushion').torus((x,y,z),.20,.012,'woven_light','X',18,6)

B('item_mat').box((.28,.12,.045),(.78,3.70,.055),'fabric_cream')
for i in range(31):
    y=-1.65+i*.117
    B('item_mat').cylinder((-.08,y,.079),(.64,y,.079),.010,'woven',5)
for x in (-.06,.62):
    B('item_mat').cylinder((x,-1.72,.082),(x,1.96,.082),.012,'rope',5)
for i in range(9):
    x=-.04+i*.08
    for y,sign in [(-1.73,-1),(1.97,1)]:
        B('item_mat').cylinder((x,y,.06),(x,y+sign*.18,.035),.010,'fabric_cream',5)

B('item_vessel').sphere((2.28,-1.80,.34),(.32,.32,.40),'clay',22,12)
B('item_vessel').cylinder((2.28,-1.80,.59),(2.28,-1.80,.80),.15,'clay',18,r2=.13)
B('item_vessel').torus((2.28,-1.80,.80),.14,.025,'clay')
B('item_vessel').cylinder((2.28,-1.80,.77),(2.28,-1.80,.785),.115,'shadow',18)
B('item_vessel').torus((2.57,-1.80,.50),.20,.035,'clay','Y')

for i in range(3):
    x=.95+i*.56; z=1.82+(i%2)*.10
    B('item_waterskins').sphere((x,2.70,z),(.22,.14,.33),'leather',16,10)
    B('item_waterskins').cylinder((x,2.70,z+.28),(x,2.70,z+.43),.065,'leather_edge',10)
    B('item_waterskins').cylinder((x,2.70,z+.40),(x,2.78,2.48),.016,'rope',6)
B('item_tanning').sphere((2.58,2.70,1.00),(.36,.055,.48),'leather_edge',14,8)
for i in range(12):
    x=2.48+random.uniform(-.25,.25); y=1.95+random.uniform(-.22,.22); z=.10+random.uniform(0,.08)
    B('item_sant').sphere((x,y,z),(.12,.05,.035),'sant',8,4)
B('room_architecture').box((1.55,2.78,1.22),(1.85,.22,.16),'wood')
for i in range(4):
    B('item_rolls').cylinder((.94+i*.40,2.68,1.34),(.94+i*.40,2.68,1.62),.115,'fabric_cream',12)

verts=[]; faces=[]; rows=28; cols=7
for j in range(rows+1):
    y=-2.02+j*(4.34/rows)
    for k in range(cols+1):
        z=.12+k*(2.24/cols)
        x=-.55+math.sin(j*.82)*.025*(.35+.65*k/cols)
        verts.append((x,y,z))
for j in range(rows):
    for k in range(cols):
        a=j*(cols+1)+k
        faces.append((a,a+1,a+cols+2,a+cols+1))
B('item_divider').add(verts,faces,'fabric_dark')
for i in range(17):
    y=-1.96+i*.265
    for z in (.28,2.20):
        B('item_divider').sphere((-.50,y,z),(.042,.048,.042),'shell',10,6)
for y in (-2.02,2.32):
    for z in (.42,.82,1.22,1.62,2.02):
        B('item_divider').sphere((-.50,y,z),(.042,.042,.042),'shell',10,6)

B('item_divider_hardware').cylinder((-.55,-2.05,2.46),(-.55,2.30,2.46),.035,'rope',8)
for y in (-2.05,2.30):
    B('item_divider_hardware').cylinder((-.55,y,0),(-.55,y,2.55),.055,'wood',8)
for i in range(45):
    x=random.uniform(-2.8,2.8); y=random.uniform(-2.7,2.7); s=random.uniform(.025,.065)
    B('room_architecture').sphere((x,y,s*.25),(s,s*.65,s*.28),'mud_dark',7,4)
flush()

save_export('interior')
print('Created exterior and interior Blender/GLB assets in',OUT)
