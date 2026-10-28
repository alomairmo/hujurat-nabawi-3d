import * as THREE from 'three';

const MATERIAL_COLORS = {
  mud:[.48,.30,.16], mud_light:[.60,.41,.24], mud_dark:[.38,.23,.12], mortar:[.43,.28,.16],
  sand:[.64,.48,.29], earth:[.50,.36,.21], palm:[.25,.14,.065], palm_light:[.37,.25,.105],
  leaf:[.20,.28,.12], wood:[.22,.12,.055], leather:[.24,.105,.045], leather_edge:[.40,.20,.075],
  woven:[.53,.37,.16], woven_light:[.66,.49,.24], rope:[.44,.31,.14], clay:[.43,.18,.085],
  sant:[.24,.27,.10], shadow:[.055,.038,.025], fabric_red:[.29,.045,.065], fabric_dark:[.028,.022,.018],
  fabric_cream:[.76,.66,.45], shell:[.84,.77,.61], grave_earth:[.40,.27,.15], door:[.18,.085,.038]
};
const materials = Object.fromEntries(Object.entries(MATERIAL_COLORS).map(([name,color]) => [
  name,new THREE.MeshStandardMaterial({color:new THREE.Color(...color),roughness:.92,metalness:0,side:THREE.DoubleSide})
]));
let seed=622;
function random(){seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}
const range=(a,b)=>a+random()*(b-a);
function tone(){const r=random();return r<.62?'mud':r<.87?'mud_light':'mud_dark';}

class Builder {
  constructor(){this.v=[];this.f=[];this.mi=[];}
  add(vertices,faces,material){
    const offset=this.v.length;
    vertices.forEach(v=>this.v.push([v.x??v[0],v.y??v[1],v.z??v[2]]));
    faces.forEach(face=>{this.f.push(face.map(i=>i+offset));this.mi.push(material);});
  }
  box(loc,size,material){
    const [x,y,z]=loc,[a,b,c]=size.map(s=>s/2);
    const v=[[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y+b,z-c],[x-a,y+b,z-c],[x-a,y-b,z+c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x-a,y+b,z+c]];
    this.add(v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material);
  }
  cylinder(a,b,r,material,sides=10,r2=null){
    a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);r2=r2??r;
    const d=b.clone().sub(a).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d),v=[];
    for(const [p,radius] of [[a,r],[b,r2]])for(let i=0;i<sides;i++){
      const angle=i*Math.PI*2/sides,point=new THREE.Vector3(radius*Math.cos(angle),radius*Math.sin(angle),0).applyQuaternion(q).add(p);v.push(point);
    }
    const f=[Array.from({length:sides},(_,i)=>sides-1-i),Array.from({length:sides},(_,i)=>i+sides)];
    for(let i=0;i<sides;i++)f.push([i,(i+1)%sides,(i+1)%sides+sides,i+sides]);
    this.add(v,f,material);
  }
  sphere(loc,scale,material,seg=12,rings=6){
    const [x,y,z]=loc,[sx,sy,sz]=scale,v=[],f=[];
    for(let j=0;j<=rings;j++){const phi=Math.PI*j/rings;for(let i=0;i<seg;i++){const th=Math.PI*2*i/seg;v.push([x+sx*Math.sin(phi)*Math.cos(th),y+sy*Math.sin(phi)*Math.sin(th),z+sz*Math.cos(phi)]);}}
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const n=(i+1)%seg;f.push([j*seg+i,j*seg+n,(j+1)*seg+n,(j+1)*seg+i]);}
    this.add(v,f,material);
  }
  torus(loc,major,minor,material,axis='Z',seg=16,tube=6){
    const [x,y,z]=loc,v=[],f=[];
    for(let i=0;i<seg;i++){const a=Math.PI*2*i/seg;for(let j=0;j<tube;j++){const b=Math.PI*2*j/tube;let p=new THREE.Vector3((major+minor*Math.cos(b))*Math.cos(a),(major+minor*Math.cos(b))*Math.sin(a),minor*Math.sin(b));if(axis==='X')p=new THREE.Vector3(p.z,p.x,p.y);if(axis==='Y')p=new THREE.Vector3(p.x,p.z,p.y);v.push([x+p.x,y+p.y,z+p.z]);}}
    for(let i=0;i<seg;i++)for(let j=0;j<tube;j++)f.push([i*tube+j,((i+1)%seg)*tube+j,((i+1)%seg)*tube+(j+1)%tube,i*tube+(j+1)%tube]);
    this.add(v,f,material);
  }
}

function flush(groups){
  const root=new THREE.Group();
  for(const [name,b] of Object.entries(groups)){
    const used=[...new Set(b.mi)],indices=used.map(()=>[]);
    b.f.forEach((face,faceIndex)=>{const target=indices[used.indexOf(b.mi[faceIndex])];for(let i=1;i<face.length-1;i++)target.push(face[0],face[i],face[i+1]);});
    const positions=[];
    b.v.forEach(([x,y,z])=>positions.push(x,z,-y));
    let geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices.flat());
    let start=0;indices.forEach((list,i)=>{geometry.addGroup(start,list.length,i);start+=list.length;});
    const smooth=name.startsWith('item_')&&['waterskins','vessel','cushion','mattress'].some(part=>name.includes(part));
    if(!smooth)geometry=geometry.toNonIndexed();geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,used.map(i=>materials[i]));mesh.name=`${name}_mesh`;
    const group=new THREE.Group();group.name=name;group.add(mesh);root.add(group);
  }
  return root;
}

function brickWall(groups,group,center,length,height,thickness,axis='X',door=null){
  const [x,y,z]=center,b=groups[group]??=new Builder();
  b.box([x,y,z+height/2],axis==='X'?[length,thickness,height]:[thickness,length,height],'mortar');
  const ch=.47,rows=Math.floor(height/ch);
  for(let row=0;row<rows;row++){
    const count=Math.max(1,Math.floor(length/1.05));
    for(let i=0;i<count;i++){
      const off=-length/2+(i+.5)*length/count+(row%2?.24:-.12);
      if(Math.abs(off)>length/2-.35)continue;
      if(door&&Math.abs(off-door[0])<door[1]/2+.35&&(row+.5)*ch<door[2])continue;
      const dz=range(-.025,.025),mat=tone();
      if(axis==='X')b.box([x+off,y-thickness*.05,z+(row+.5)*ch+dz],[length/count-.035,thickness*1.10,ch-.035],mat);
      else b.box([x-thickness*.05,y+off,z+(row+.5)*ch+dz],[thickness*1.10,length/count-.035,ch-.035],mat);
    }
  }
}
function palm(groups,group,x,y,h=6){
  const b=groups[group]??=new Builder();b.cylinder([x,y,0],[x,y,h],.24,'palm',12,.15);
  for(let k=0;k<11;k++){
    const a=k*Math.PI*2/11+range(-.12,.12),length=range(2.2,3.1),base=new THREE.Vector3(x,y,h),end=base.clone().add(new THREE.Vector3(Math.cos(a)*length,Math.sin(a)*length,range(-.9,.2))),mid=base.clone().add(new THREE.Vector3(Math.cos(a)*length*.52,Math.sin(a)*length*.52,.45));
    b.cylinder(base,mid,.035,'palm_light',6,.025);b.cylinder(mid,end,.025,'palm_light',6,.012);
    const side=new THREE.Vector3(-Math.sin(a),Math.cos(a),0);
    for(let j=1;j<9;j++){const t=j/9,p=mid.clone().lerp(end,t);for(const sign of [-1,1]){const e=p.clone().add(side.clone().multiplyScalar(sign*(.45*(1-t)+.12))).add(new THREE.Vector3(0,0,-.18));b.cylinder(p,e,.022,'leaf',5,.008);}}
  }
}
function palisade(groups,group,a,b,height=1.65){
  const builder=groups[group]??=new Builder(),start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),count=Math.max(2,Math.floor(start.distanceTo(end)/.27)+1);
  for(let i=0;i<count;i++){const p=start.clone().lerp(end,i/(count-1)),h=height+range(-.14,.14),lean=new THREE.Vector3(range(-.045,.045),range(-.045,.045),0);builder.cylinder(p,p.clone().add(new THREE.Vector3(0,0,h)).add(lean),.045,'palm_light',6,.032);}
  for(const z of [.48,1.16])builder.cylinder(start.clone().add(new THREE.Vector3(0,0,z)),end.clone().add(new THREE.Vector3(0,0,z)),.035,'palm',6);
}
function eastRoom(groups,group,y){
  const h=2.70+range(-.06,.06),b=groups[group]??=new Builder();
  brickWall(groups,group,[24.4,y,0],3.6,h,.38,'Y');brickWall(groups,group,[22.2,y+1.8,0],4.4,h,.38,'X');brickWall(groups,group,[22.2,y-1.8,0],4.4,h,.38,'X');brickWall(groups,group,[20,y,0],3.6,h,.38,'Y',[0,1.05,1.92]);
  b.box([19.78,y,.94],[.045,.91,1.88],'shadow');b.box([22.2,y,h+.06],[4.65,3.86,.22],'mud_light');
  for(let j=0;j<7;j++)b.cylinder([19.9,y-1.62+j*.54,h-.10],[24.55,y-1.62+j*.54,h-.10],.055,'palm',6);
  for(const yy of [y-1.79,y+1.79])b.box([22.2,yy,h+.25],[4.58,.20,.30],'mud');
  b.box([24.39,y,h+.25],[.20,3.62,.30],'mud');b.box([22.2,y-3.02,.035],[4.18,2.18,.07],'earth');
  palisade(groups,group,[20,y-4.22,0],[24.4,y-4.22,0]);palisade(groups,group,[24.4,y-4.22,0],[24.4,y-1.92,0]);palisade(groups,group,[20,y-4.22,0],[20,y-2.85,0]);
}
function northRoom(groups,group,x){
  const y=21.2,h=2.70+range(-.06,.06),b=groups[group]??=new Builder();
  brickWall(groups,group,[x,23.1,0],5.2,h,.38,'X');brickWall(groups,group,[x-2.6,y,0],3.8,h,.38,'Y');brickWall(groups,group,[x+2.6,y,0],3.8,h,.38,'Y');brickWall(groups,group,[x,19.3,0],5.2,h,.38,'X',[0,1.05,1.92]);
  b.box([x,19.08,.94],[.91,.045,1.88],'shadow');b.box([x,y,h+.06],[5.46,4.05,.22],'mud_light');
  for(let j=0;j<9;j++)b.cylinder([x-2.42+j*.605,19.18,h-.10],[x-2.42+j*.605,23.25,h-.10],.055,'palm',6);
  for(const xx of [x-2.59,x+2.59])b.box([xx,y,h+.25],[.20,3.84,.30],'mud');
  b.box([x,23.09,h+.25],[5.24,.20,.30],'mud');b.box([x+3.66,y,.035],[1.82,3.56,.07],'earth');
  palisade(groups,group,[x+4.58,19.35,0],[x+4.58,23.05,0]);palisade(groups,group,[x+2.75,23.05,0],[x+4.58,23.05,0]);palisade(groups,group,[x+3.70,19.35,0],[x+4.58,19.35,0]);
}

export function createExteriorModel(){
  seed=622;const g={},B=name=>g[name]??=new Builder();
  B('scene_base').box([1.5,1.5,-.35],[64,59,.65],'sand');B('scene_base').box([0,0,.015],[36,32,.12],'earth');
  brickWall(g,'mosque_walls',[0,-16,0],36,4.15,.65,'X');brickWall(g,'mosque_walls',[0,16,0],36,4.15,.65,'X',[0,2,2.5]);brickWall(g,'mosque_walls',[-18,0,0],32,4.15,.65,'Y',[0,2,2.5]);brickWall(g,'mosque_walls',[18,0,0],32,4.15,.65,'Y',[-5,1.6,2.3]);
  B('mosque_walls').box([0,16.34,1.2],[1.75,.05,2.4],'shadow');B('mosque_walls').box([-18.34,0,1.2],[.05,1.75,2.4],'shadow');
  for(const [zone,ys,roofY,depth] of [['south',[-14.7,-10.8,-6.9],-11.5,9],['north',[14.7,11.4],13.4,5.2]]){
    for(const y of ys)for(const x of [-15,-11,-7,-3,1,5,9,13,16]){if(zone==='north'&&x>13)continue;const h=zone==='south'?3.75:3.45;B('palm_columns').cylinder([x,y,0],[x,y,h],.19,'palm',10,.15);B('palm_columns').torus([x,y,h-.25],.19,.035,'rope');}
    const z=zone==='south'?3.95:3.65;B('palm_roofs').box([0,roofY,z],[35.4,depth,.24],'palm_light');
    for(let i=0;i<44;i++){const x=-17.2+i*.8;B('palm_roofs').cylinder([x,roofY-depth/2,z-.16],[x,roofY+depth/2,z-.16],.045,'palm',6);}
    for(let j=0;j<4;j++){const y=roofY-depth/2+.6+j*(depth-1.2)/3;B('palm_roofs').cylinder([-17.4,y,z-.22],[17.4,y,z-.22],.10,'palm',8);}
  }
  for(let i=0;i<3;i++)B('minbar').box([-4.5,-14.8+i*.36,.18+i*.20],[1.25,.42,.36+i*.40],'wood');
  B('minbar').cylinder([-5.05,-15,.2],[-5.05,-13.8,1.35],.055,'wood');B('minbar').cylinder([-3.95,-15,.2],[-3.95,-13.8,1.35],.055,'wood');
  for(const [group,y] of [['room_sawda',-14.4],['room_aisha',-7.2],['room_hafsa',0],['room_umm_salama',7.2],['room_zaynab_jahsh',14.4]])eastRoom(g,group,y);
  for(const [group,x] of [['room_zaynab_khuzayma',-12],['room_umm_habiba',-4],['room_safiyya',4],['room_fatima_ali',12]])northRoom(g,group,x);
  for(const [x,y,h] of [[-22,13,6.2],[-24,-11,5.7],[27,18,6.5],[-17,25,5.9],[28,-18,5.8]])palm(g,'date_palms',x,y,h);
  for(let i=0;i<42;i++){const x=range(-29,30),y=random()<.5?range(25,28):range(-25,-20),s=range(.08,.22);B('scene_base').sphere([x,y,s*.35],[s,s*.72,s*.4],'mud_dark',8,4);}
  return flush(g);
}

export function createInteriorModel(){
  seed=622;const g={},B=name=>g[name]??=new Builder();
  B('room_floor').box([0,0,-.13],[7.35,7.25,.26],'sand');
  brickWall(g,'room_architecture',[0,3.05,0],6.4,2.75,.35,'X');brickWall(g,'room_architecture',[-3.05,0,0],6.1,2.75,.35,'Y');brickWall(g,'room_architecture',[3.05,0,0],6.1,.78,.35,'Y');brickWall(g,'room_architecture',[0,-3.05,0],6.4,.78,.35,'X');
  for(const x of [-3.02,3.02])for(const y of [-3.02,3.02])B('room_architecture').cylinder([x,y,0],[x,y,2.85],.14,'palm',10,.12);
  for(const y of [-2.8,2.8])B('room_roof_edge').cylinder([-3.15,y,2.86],[3.15,y,2.86],.12,'palm',10);
  B('room_roof_edge').cylinder([-3.04,-3.1,2.88],[-3.04,3.1,2.88],.09,'palm_light',8);
  B('item_mat').box([.58,.20,.025],[4.70,5.30,.05],'woven');
  for(let i=0;i<52;i++){const y=-2.40+i*.102;B('item_mat_weave').cylinder([-1.73,y,.058],[2.88,y,.058],.0065,i%4===0?'fabric_cream':'woven_light',5);}
  for(const x of [-1.78,2.94])B('item_mat_border').cylinder([x,-2.45,.062],[x,2.85,.062],.022,'fabric_cream',7);
  for(const y of [-2.48,2.88])B('item_mat_border').cylinder([-1.78,y,.062],[2.94,y,.062],.022,'fabric_cream',7);
  for(let i=0;i<25;i++){const x=-1.7+i*.188;B('item_mat_border').cylinder([x,-2.50,.04],[x+range(-.025,.025),-2.67,.035],.008,'fabric_cream',5);}
  B('item_bed_frame').box([1.55,.25,.25],[1.60,3.42,.14],'wood');
  for(const x of [.88,2.22])for(const y of [-1.30,1.80]){
    B('item_bed_frame').cylinder([x,y,0],[x,y,.44],.085,'wood',10,.072);B('item_bed_frame').sphere([x,y,.47],[.11,.11,.10],'palm_light',12,6);
    for(const z of [.22,.28,.34])B('item_bed_frame').torus([x,y,z],.085,.012,'rope');
  }
  for(const x of [.88,2.22])B('item_bed_frame').cylinder([x,-1.3,.32],[x,1.8,.32],.06,'wood');
  for(const y of [-1.30,1.80])B('item_bed_frame').cylinder([.88,y,.32],[2.22,y,.32],.06,'wood');
  for(let j=0;j<15;j++){const y=-1.25+j*.216;B('item_bed_mesh').cylinder([.90,y,.405],[2.20,y,.405],.021,j%2?'rope':'woven_light',6);}
  for(let i=0;i<8;i++){const x=.94+i*.17;B('item_bed_mesh').cylinder([x,-1.30,.415],[x,1.80,.415],.016,'rope',6);}
  B('item_bedspread').box([1.55,.25,.535],[1.40,3.23,.20],'fabric_red');B('item_bedspread').box([1.55,.25,.575],[1.40,3.23,.055],'fabric_red');
  for(const x of [.90,2.20])B('item_bedspread').cylinder([x,-1.34,.61],[x,1.84,.61],.014,'fabric_cream',6);
  for(let i=0;i<17;i++){const y=-1.25+i*.185;B('item_bedspread').cylinder([.94,y,.612],[2.16,y,.612],.008,'woven_light',5);}
  for(const x of [.88,2.22])for(let j=0;j<16;j++){const y=-1.25+j*.20;B('item_bedspread').cylinder([x,y,.58],[x+range(-.025,.025),y,.42-range(0,.05)],.012,'fabric_cream',5);}
  B('item_cushion').box([1.55,1.30,.79],[1.10,.62,.32],'fabric_cream');
  for(let i=0;i<7;i++){const x=1.09+i*.153;B('item_cushion_seams').cylinder([x,1.02,.75],[x,1.58,.75],.006,'woven',5);}
  B('item_mattress').box([1.55,-.88,.74],[1.07,.61,.22],'fabric_dark');B('item_mattress').box([1.55,-.91,.84],[1.01,.55,.12],'woven');
  B('item_tanning_tools').box([.16,-1.93,.075],[1.15,.72,.15],'leather_edge');B('item_tanning_tools').box([.16,-1.93,.158],[1.05,.62,.04],'leather');B('item_tanning_tools').torus([.16,-1.93,.18],.22,.045,'rope');
  for(const [i,yy] of [[0,1.40],[1,.58],[2,-.20]]){
    const group='item_waterskins',x=-2.55+i*.10;B(group).sphere([x,yy,.37],[.32,.44,.34],'leather',18,10);B(group).sphere([x,yy+.14,.43],[.24,.33,.27],'leather',16,8);B(group).cylinder([x,yy+.28,.53],[x,yy+.38,.73],.075,'leather',10,.065);B(group).cylinder([x,yy+.38,.72],[x,yy+.40,.76],.082,'wood',10);B(group).torus([x,yy,.35],.31,.018,'rope');B(group).cylinder([x,yy+.2,.66],[x-.10,yy+.42,.93],.018,'rope',6);B(group).cylinder([x-.10,yy+.42,.93],[x+.06,yy+.52,.65],.018,'rope',6);
  }
  B('item_vessel').cylinder([-.02,1.89,.03],[-.02,1.89,.50],.26,'clay',18,.22);B('item_vessel').sphere([-.02,1.89,.35],[.28,.28,.22],'clay',18,10);B('item_vessel').cylinder([-.02,1.89,.48],[-.02,1.89,.61],.12,'clay',14,.15);B('item_vessel').torus([-.02,1.89,.61],.15,.025,'clay');B('item_vessel').cylinder([-.02,1.89,.605],[-.02,1.89,.607],.12,'shadow',16);
  const vertices=[],faces=[],rows=28,cols=7;
  for(let j=0;j<=rows;j++){const y=-2.02+j*(4.34/rows);for(let k=0;k<=cols;k++){const z=.12+k*(2.24/cols),x=-.55+Math.sin(j*.82)*.025*(.35+.65*k/cols);vertices.push([x,y,z]);}}
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=j*(cols+1)+k;faces.push([a,a+1,a+cols+2,a+cols+1]);}
  B('item_divider').add(vertices,faces,'fabric_dark');
  for(let row=0;row<8;row++)for(let col=0;col<14;col++){
    const y=-1.88+col*.305,z=.27+row*.265;
    if(row===7&&col%2)continue;
    B('item_divider_dots').sphere([-.525,y,z],[.013,.027,.027],row%3===0?'fabric_cream':'shell',8,4);
  }
  for(const y of [-2.08,2.38]){
    B('item_divider_hardware').cylinder([-.55,y,0],[-.55,y,2.60],.065,'wood',10,.052);B('item_divider_hardware').cylinder([-.55,y,0],[-.55,y,.15],.17,'mud_dark',10,.11);B('item_divider_hardware').sphere([-.55,y,2.64],[.085,.085,.085],'palm_light',10,6);
    for(const z of [2.33,2.39,2.45])B('item_divider_hardware').torus([-.55,y,z],.067,.012,'rope');
  }
  B('item_divider_hardware').cylinder([-.55,-2.08,2.45],[-.55,2.38,2.45],.027,'rope',8);
  for(let j=0;j<13;j++){const y=-1.98+j*.35;B('item_divider_hardware').cylinder([-.55,y,.16],[-.55,y,.045],.012,'rope',6);}
  for(const [group,y] of [['item_grave_prophet',1.45],['item_grave_abu_bakr',0],['item_grave_umar',-1.45]]){
    B(group).box([-1.85,y,.09],[1.30,1.42,.18],'grave_earth');B(group).sphere([-1.85,y,.20],[.54,.63,.16],'grave_earth',18,8);B(group).sphere([-1.85,y+.43,.37],[.16,.13,.11],'mud_light',12,6);
    for(let j=0;j<7;j++){const x=-1.85+range(-.45,.45),yy=y+range(-.47,.47),s=range(.035,.075);B(group).sphere([x,yy,.36],[s,s*.75,s*.55],'mud_dark',8,4);}
  }
  B('item_door').box([1.93,2.85,1.0],[1.05,.12,2.0],'shadow');
  for(let i=0;i<5;i++)B('item_door').box([1.51+i*.21,2.77,.98],[.19,.10,1.90],'door');
  for(const z of [.48,1.48])B('item_door').box([1.93,2.70,z],[1.02,.07,.09],'wood');
  B('item_door').torus([1.64,2.65,1.0],.07,.015,'palm_light','Y',12,6);
  return flush(g);
}
