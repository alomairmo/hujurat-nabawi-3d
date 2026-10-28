import * as THREE from 'three';

const MATERIAL_COLORS = {
  mud:[.50,.33,.20], mud_light:[.62,.45,.29], mud_dark:[.39,.25,.15], mortar:[.44,.30,.19],
  sand:[.66,.51,.33], earth:[.51,.37,.23], palm:[.25,.15,.075], palm_light:[.40,.28,.13],
  leaf:[.20,.28,.12], leaf_light:[.29,.36,.16], wood:[.22,.12,.055], leather:[.25,.12,.065],
  leather_edge:[.43,.24,.11], woven:[.57,.41,.20], woven_light:[.74,.58,.32], rope:[.47,.34,.17],
  clay:[.52,.25,.12], clay_light:[.65,.36,.18], clay_dark:[.25,.14,.09], metal:[.34,.38,.36],
  sant:[.25,.29,.11], shadow:[.045,.032,.022], fabric_red:[.34,.045,.068], fabric_dark:[.035,.028,.024],
  fabric_cream:[.82,.73,.54], shell:[.88,.81,.65], grave_earth:[.43,.30,.18], door:[.20,.10,.045],
  stone:[.47,.46,.40], stone_light:[.61,.59,.50], wool:[.33,.19,.09]
};
const materials = Object.fromEntries(Object.entries(MATERIAL_COLORS).map(([name,color]) => [
  name,new THREE.MeshStandardMaterial({color:new THREE.Color(...color),roughness:name==='metal'?.58:.94,metalness:name==='metal'?.42:0,side:THREE.DoubleSide})
]));
let seed=622;
function random(){seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}
const range=(a,b)=>a+random()*(b-a);
const choose=(values)=>values[Math.floor(random()*values.length)];
function tone(){const r=random();return r<.58?'mud':r<.86?'mud_light':'mud_dark';}

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
  cylinder(a,b,r,material,sides=12,r2=null){
    a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);r2=r2??r;
    const d=b.clone().sub(a).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d),v=[];
    for(const [p,radius] of [[a,r],[b,r2]])for(let i=0;i<sides;i++){
      const angle=i*Math.PI*2/sides,point=new THREE.Vector3(radius*Math.cos(angle),radius*Math.sin(angle),0).applyQuaternion(q).add(p);v.push(point);
    }
    const f=[Array.from({length:sides},(_,i)=>sides-1-i),Array.from({length:sides},(_,i)=>i+sides)];
    for(let i=0;i<sides;i++)f.push([i,(i+1)%sides,(i+1)%sides+sides,i+sides]);
    this.add(v,f,material);
  }
  sphere(loc,scale,material,seg=16,rings=9){
    const [x,y,z]=loc,[sx,sy,sz]=scale,v=[],f=[];
    for(let j=0;j<=rings;j++){const phi=Math.PI*j/rings;for(let i=0;i<seg;i++){const th=Math.PI*2*i/seg;v.push([x+sx*Math.sin(phi)*Math.cos(th),y+sy*Math.sin(phi)*Math.sin(th),z+sz*Math.cos(phi)]);}}
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const n=(i+1)%seg;f.push([j*seg+i,j*seg+n,(j+1)*seg+n,(j+1)*seg+i]);}
    this.add(v,f,material);
  }
  torus(loc,major,minor,material,axis='Z',seg=24,tube=7){
    const [x,y,z]=loc,v=[],f=[];
    for(let i=0;i<seg;i++){const a=Math.PI*2*i/seg;for(let j=0;j<tube;j++){const b=Math.PI*2*j/tube;let p=new THREE.Vector3((major+minor*Math.cos(b))*Math.cos(a),(major+minor*Math.cos(b))*Math.sin(a),minor*Math.sin(b));if(axis==='X')p=new THREE.Vector3(p.z,p.x,p.y);if(axis==='Y')p=new THREE.Vector3(p.x,p.z,p.y);v.push([x+p.x,y+p.y,z+p.z]);}}
    for(let i=0;i<seg;i++)for(let j=0;j<tube;j++)f.push([i*tube+j,((i+1)%seg)*tube+j,((i+1)%seg)*tube+(j+1)%tube,i*tube+(j+1)%tube]);
    this.add(v,f,material);
  }
  lathe(loc,profile,material,segments=28){
    const [x,y,z]=loc,v=[],f=[];
    for(const [radius,height] of profile)for(let i=0;i<segments;i++){
      const a=i*Math.PI*2/segments;v.push([x+radius*Math.cos(a),y+radius*Math.sin(a),z+height]);
    }
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
      const n=(i+1)%segments,a=j*segments+i,b=j*segments+n,c=(j+1)*segments+n,d=(j+1)*segments+i;f.push([a,b,c,d]);
    }
    this.add(v,f,material);
  }
}

function flush(groups){
  const root=new THREE.Group();
  for(const [name,b] of Object.entries(groups)){
    const used=[...new Set(b.mi)],indices=used.map(()=>[]);
    b.f.forEach((face,faceIndex)=>{const target=indices[used.indexOf(b.mi[faceIndex])];for(let i=1;i<face.length-1;i++)target.push(face[0],face[i],face[i+1]);});
    const positions=[];b.v.forEach(([x,y,z])=>positions.push(x,z,-y));
    let geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices.flat());
    let start=0;indices.forEach((list,i)=>{geometry.addGroup(start,list.length,i);start+=list.length;});
    const smooth=name.startsWith('item_')&&/waterskins|vessel|cushion|mattress|pot|bowl|cup|bucket|quern|mill|grave|fleece|tray/.test(name);
    if(!smooth)geometry=geometry.toNonIndexed();geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,used.map(i=>materials[i]));mesh.name=`${name}_mesh`;
    const group=new THREE.Group();group.name=name;group.add(mesh);root.add(group);
  }
  return root;
}

function wallCore(b,center,length,height,thickness,axis,door){
  const [x,y,z]=center;
  const segment=(offset,span,z0,h)=>{if(span<=0||h<=0)return;const loc=axis==='X'?[x+offset,y,z+z0+h/2]:[x,y+offset,z+z0+h/2];const size=axis==='X'?[span,thickness,h]:[thickness,span,h];b.box(loc,size,'mortar');};
  if(!door){segment(0,length,0,height);return;}
  const [offset,width,doorHeight]=door,left=-length/2,right=length/2,a=offset-width/2,c=offset+width/2;
  segment((left+a)/2,a-left,0,height);segment((c+right)/2,right-c,0,height);segment(offset,width,doorHeight,height-doorHeight);
}
function brickWall(groups,group,center,length,height,thickness,axis='X',door=null){
  const [x,y,z]=center,b=groups[group]??=new Builder();wallCore(b,center,length,height,thickness,axis,door);
  const ch=.43,rows=Math.floor(height/ch);
  for(let row=0;row<rows;row++){
    const count=Math.max(1,Math.round(length/.94));
    for(let i=0;i<count;i++){
      const off=-length/2+(i+.5)*length/count+(row%2?.19:-.10);
      if(Math.abs(off)>length/2-.30)continue;
      if(door&&Math.abs(off-door[0])<door[1]/2+.25&&(row+.5)*ch<door[2])continue;
      const dz=range(-.018,.018),mat=tone(),span=length/count-.028;
      if(axis==='X')b.box([x+off,y-thickness*.04,z+(row+.5)*ch+dz],[span,thickness*1.08,ch-.026],mat);
      else b.box([x-thickness*.04,y+off,z+(row+.5)*ch+dz],[thickness*1.08,span,ch-.026],mat);
    }
  }
}
function palm(groups,group,x,y,h=6){
  const b=groups[group]??=new Builder();b.cylinder([x,y,0],[x+.08,y,h],.22,'palm',12,.13);
  for(let ring=0;ring<11;ring++)b.torus([x+.08*ring/11,y,ring*h/11],.21-ring*.008,.018,'palm_light','Z',12,5);
  for(let k=0;k<13;k++){
    const a=k*Math.PI*2/13+range(-.09,.09),length=range(2.0,2.85),base=new THREE.Vector3(x+.08,y,h),end=base.clone().add(new THREE.Vector3(Math.cos(a)*length,Math.sin(a)*length,range(-1.0,-.25))),mid=base.clone().add(new THREE.Vector3(Math.cos(a)*length*.50,Math.sin(a)*length*.50,.38));
    b.cylinder(base,mid,.035,'palm_light',6,.024);b.cylinder(mid,end,.024,'palm_light',6,.009);
    const side=new THREE.Vector3(-Math.sin(a),Math.cos(a),0);
    for(let j=1;j<11;j++){const t=j/11,p=mid.clone().lerp(end,t);for(const sign of [-1,1]){const e=p.clone().add(side.clone().multiplyScalar(sign*(.48*(1-t)+.10))).add(new THREE.Vector3(0,0,-.16));b.cylinder(p,e,.019,choose(['leaf','leaf_light']),5,.005);}}
  }
}
function palisade(groups,group,a,b,height=1.45){
  const builder=groups[group]??=new Builder(),start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),count=Math.max(2,Math.floor(start.distanceTo(end)/.24)+1);
  for(let i=0;i<count;i++){const p=start.clone().lerp(end,i/(count-1)),h=height+range(-.13,.13),lean=new THREE.Vector3(range(-.04,.04),range(-.04,.04),0);builder.cylinder(p,p.clone().add(new THREE.Vector3(0,0,h)).add(lean),.041,'palm_light',6,.029);}
  for(const z of [.43,1.05])builder.cylinder(start.clone().add(new THREE.Vector3(0,0,z)),end.clone().add(new THREE.Vector3(0,0,z)),.031,'palm',6);
}
function doorLeaf(b,x,y,z,width,height,axis='X'){
  const planks=6;
  for(let i=0;i<planks;i++){
    const off=-width/2+(i+.5)*width/planks;
    if(axis==='X')b.box([x+off,y,z+height/2],[width/planks-.018,.10,height],'door');
    else b.box([x,y+off,z+height/2],[.10,width/planks-.018,height],'door');
  }
  for(const h of [height*.25,height*.73]){
    if(axis==='X')b.box([x,y-.065,z+h],[width,.07,.085],'wood');else b.box([x-.065,y,z+h],[.07,width,.085],'wood');
  }
}
function roof(b,x,y,w,d,h){
  b.box([x,y,h],[w,d,.18],'mud_light');
  const beams=Math.max(5,Math.round(w/.52));
  for(let i=0;i<beams;i++){const xx=x-w/2+(i+.5)*w/beams;b.cylinder([xx,y-d/2-.16,h-.15],[xx,y+d/2+.16,h-.15],.047,'palm',7);}
  for(const yy of [y-d/2+.08,y+d/2-.08])b.box([x,yy,h+.16],[w,.16,.25],'mud');
  for(const xx of [x-w/2+.08,x+w/2-.08])b.box([xx,y,h+.16],[.16,d,.25],'mud');
}
function eastUnit(groups,id,y){
  const group=`room_${id}`,b=groups[group]??=new Builder(),x=21.65,h=2.65+range(-.04,.04);
  brickWall(groups,group,[24.0,y,0],3.65,h,.34,'Y');
  brickWall(groups,group,[x,y+1.82,0],4.7,h,.34,'X');brickWall(groups,group,[x,y-1.82,0],4.7,h,.34,'X');
  brickWall(groups,group,[19.3,y,0],3.65,h,.34,'Y',[0,1.0,1.88]);
  doorLeaf(b,19.48,y+.67,.02,.83,1.82,'Y');roof(b,x,y,4.78,3.74,h+.04);
  b.box([x,y-3.14,.025],[4.5,2.55,.05],'earth');
  palisade(groups,group,[19.3,y-4.48,0],[24.05,y-4.48,0]);palisade(groups,group,[24.05,y-4.48,0],[24.05,y-1.93,0]);palisade(groups,group,[19.3,y-4.48,0],[19.3,y-2.85,0]);
}
function northUnit(groups,id,x){
  const group=`room_${id}`,b=groups[group]??=new Builder(),y=20.15,h=2.65+range(-.04,.04);
  brickWall(groups,group,[x,22.05,0],4.45,h,.34,'X');
  brickWall(groups,group,[x-2.22,y,0],3.8,h,.34,'Y');brickWall(groups,group,[x+2.22,y,0],3.8,h,.34,'Y');
  brickWall(groups,group,[x,18.25,0],4.45,h,.34,'X',[0,1.0,1.88]);
  doorLeaf(b,x+.64,18.43,.02,.82,1.82,'X');roof(b,x,y,4.54,3.9,h+.04);
  b.box([x+3.35,y,.025],[2.15,3.62,.05],'earth');
  palisade(groups,group,[x+4.48,18.3,0],[x+4.48,22.02,0]);palisade(groups,group,[x+2.3,22.02,0],[x+4.48,22.02,0]);palisade(groups,group,[x+3.48,18.3,0],[x+4.48,18.3,0]);
}

export function createExteriorModel(){
  seed=622;const g={},B=name=>g[name]??=new Builder();
  B('scene_base').box([2,2,-.34],[63,61,.64],'sand');B('scene_base').box([0,0,.015],[36,32,.12],'earth');
  brickWall(g,'mosque_walls',[0,-16,0],36,4.0,.62,'X');brickWall(g,'mosque_walls',[0,16,0],36,4.0,.62,'X',[0,1.8,2.4]);
  brickWall(g,'mosque_walls',[-18,0,0],32,4.0,.62,'Y',[0,1.8,2.4]);brickWall(g,'mosque_walls',[18,0,0],32,4.0,.62,'Y',[-6.3,1.25,2.15]);
  doorLeaf(B('mosque_walls'),0,16.28,.02,1.55,2.35);doorLeaf(B('mosque_walls'),-18.28,0,.02,1.55,2.35,'Y');
  const zones=[{name:'south',rows:[-14.7,-10.9,-7.1],center:-10.9,depth:9.2,height:3.75},{name:'north',rows:[14.6,11.6],center:13.2,depth:5.5,height:3.5}];
  for(const zone of zones){
    for(const y of zone.rows)for(const x of [-15,-11,-7,-3,1,5,9,13,16]){if(zone.name==='north'&&x>13)continue;B('palm_columns').cylinder([x,y,0],[x,y,zone.height],.18,'palm',11,.14);for(const z of [zone.height-.28,zone.height-.20])B('palm_columns').torus([x,y,z],.18,.025,'rope','Z',12,5);}
    roof(B('palm_roofs'),0,zone.center,35.5,zone.depth,zone.height+.12);
    for(let i=0;i<54;i++){const x=-17.3+i*.65;B('palm_roofs').cylinder([x,zone.center-zone.depth/2,zone.height+.24],[x,zone.center+zone.depth/2,zone.height+.24],.027,'woven',5);}
  }
  for(let i=0;i<3;i++)B('minbar').box([-4.5,-14.7+i*.36,.16+i*.19],[1.18,.42,.32+i*.38],'wood');
  for(const x of [-5.02,-3.98])B('minbar').cylinder([x,-15,.18],[x,-13.8,1.25],.05,'wood');
  const east=[['sawda',-12.6],['aisha',-6.3],['hafsa',0],['umm_salama',6.3],['zaynab_jahsh',12.6]];
  const north=[['zaynab_khuzayma',-10.2],['umm_habiba',-3.4],['safiyya',3.4],['fatima_ali',10.2]];
  east.forEach(([id,y])=>eastUnit(g,id,y));north.forEach(([id,x])=>northUnit(g,id,x));
  const palmSites=[[-23,-17],[-24,-7],[-24,5],[-22,17],[-16,26],[-7,26],[2,27],[12,27],[22,25],[28,19],[29,10],[29,1],[29,-8],[27,-18],[18,-22],[8,-23],[-3,-23],[-14,-23]];
  palmSites.forEach(([x,y],i)=>palm(g,'date_palms',x,y,5.4+(i%4)*.34));
  for(let i=0;i<70;i++){const x=range(-28,30),y=random()<.5?range(24,29):range(-25,-20),s=range(.06,.18);B('scene_base').sphere([x,y,s*.3],[s,s*.72,s*.38],'mud_dark',8,4);}
  return flush(g);
}

function wovenMat(B,name,x,y,w,d){
  B(name).box([x,y,.028],[w,d,.055],'woven');
  const rows=Math.round(d/.09);
  for(let i=0;i<=rows;i++){const yy=y-d/2+i*d/rows;B(`${name}_weave`).cylinder([x-w/2,yy,.063],[x+w/2,yy,.063],.006,i%5===0?'fabric_cream':'woven_light',5);}
  for(const xx of [x-w/2,x+w/2])B(`${name}_border`).cylinder([xx,y-d/2,.068],[xx,y+d/2,.068],.019,'fabric_cream',7);
  for(const yy of [y-d/2,y+d/2]){B(`${name}_border`).cylinder([x-w/2,yy,.068],[x+w/2,yy,.068],.019,'fabric_cream',7);for(let i=0;i<Math.round(w/.14);i++){const xx=x-w/2+(i+.5)*w/Math.round(w/.14);B(`${name}_border`).cylinder([xx,yy,.04],[xx+range(-.02,.02),yy+(yy<y?-.18:.18),.025],.007,'fabric_cream',5);}}
}
function openVessel(B,x,y,r,h,material='clay'){
  B.lathe([x,y,.02],[[0,0],[r*.68,0],[r*.92,h*.15],[r,h*.55],[r*.86,h*.88],[r*.82,h],[r*.68,h],[r*.70,h*.86],[r*.82,h*.53],[r*.70,h*.20],[0,h*.15]],material,28);
  B.torus([x,y,h+.02],r*.75,.025,material);
}
function pillow(B,name,x,y,z,w,d,h,material='fabric_cream'){
  B(name).sphere([x,y,z],[w/2,d/2,h/2],material,20,10);
  B(`${name}_seams`).torus([x,y,z],Math.min(w,d)*.43,.009,'woven','Z',24,5);
}
function buildBed(g){
  const B=name=>g[name]??=new Builder(),x=2.25,y=.55,w=1.55,len=3.55;
  for(const xx of [x-w/2,x+w/2])for(const yy of [y-len/2,y+len/2]){
    B('item_bed_frame').cylinder([xx,yy,0],[xx,yy,.46],.073,'wood',10,.06);B('item_bed_frame').sphere([xx,yy,.48],[.095,.095,.085],'palm_light',12,6);
    for(const z of [.20,.26,.32])B('item_bed_frame').torus([xx,yy,z],.075,.011,'rope','Z',12,5);
  }
  for(const xx of [x-w/2,x+w/2])B('item_bed_frame').cylinder([xx,y-len/2,.34],[xx,y+len/2,.34],.055,'wood');
  for(const yy of [y-len/2,y+len/2])B('item_bed_frame').cylinder([x-w/2,yy,.34],[x+w/2,yy,.34],.055,'wood');
  for(let j=0;j<19;j++){const yy=y-len/2+j*len/18;B('item_bed_mesh').cylinder([x-w/2,yy,.39],[x+w/2,yy,.39],.018,j%2?'rope':'woven_light',6);}
  for(let i=0;i<9;i++){const xx=x-w/2+i*w/8;B('item_bed_mesh').cylinder([xx,y-len/2,.40],[xx,y+len/2,.40],.013,'rope',6);}
  B('item_mattress').sphere([x,y,.53],[w*.49,len*.49,.16],'fabric_dark',24,10);
  B('item_bedspread').box([x,y,.59],[w*.94,len*.94,.16],'fabric_red');
  for(let i=0;i<24;i++){const yy=y-len*.46+i*len*.92/23;B('item_bedspread_weave').cylinder([x-w*.45,yy,.678],[x+w*.45,yy,.678],.006,i%4===0?'fabric_cream':'woven',5);}
  for(const xx of [x-w*.47,x+w*.47]){B('item_bedspread_border').cylinder([xx,y-len*.47,.66],[xx,y+len*.47,.66],.014,'fabric_cream',6);for(let j=0;j<18;j++){const yy=y-len*.46+j*len*.92/17;B('item_bedspread_border').cylinder([xx,yy,.60],[xx+range(-.02,.02),yy,.44-range(0,.04)],.009,'fabric_cream',5);}}
  pillow(B,'item_cushion',x-.28,y+1.18,.88,.90,.64,.30);pillow(B,'item_cushion',x+.38,y+1.26,.88,.70,.62,.29);pillow(B,'item_cushion',x+.40,y+.55,.84,.62,.55,.25);
  openVessel(B('item_vessel'),x,y-len/2-.48,.29,.40,'clay_light');
}

function graveMound(B,x,y,w,d,h){
  const outline=[[-.34,-.50],[.34,-.50],[.50,-.30],[.48,.32],[.30,.50],[-.30,.50],[-.48,.32],[-.50,-.30]];
  const rings=[[1,.025],[.93,h*.48],[.68,h]],vertices=[],faces=[];
  for(const [scale,z] of rings)for(const [ox,oy] of outline)vertices.push([x+ox*w*scale,y+oy*d*scale,z+range(-.012,.012)]);
  faces.push(Array.from({length:8},(_,i)=>7-i));
  for(let ring=0;ring<2;ring++)for(let i=0;i<8;i++){const n=(i+1)%8,a=ring*8+i,b=ring*8+n,c=(ring+1)*8+n,d0=(ring+1)*8+i;faces.push([a,b,c,d0]);}
  const center=vertices.length;vertices.push([x,y,h+.012]);for(let i=0;i<8;i++)faces.push([16+i,16+(i+1)%8,center]);
  B.add(vertices,faces,'grave_earth');
}

export function createInteriorModel(){
  seed=622;const g={},B=name=>g[name]??=new Builder();
  B('room_floor').box([0,-.85,-.14],[8.35,8.80,.28],'earth');
  brickWall(g,'room_architecture',[0,3.55,0],8.1,2.8,.34,'X');brickWall(g,'room_architecture',[-4.0,-.85,0],8.8,2.8,.34,'Y');
  brickWall(g,'room_architecture',[4.0,-.85,0],8.8,.72,.34,'Y');brickWall(g,'room_architecture',[0,-5.25,0],8.1,.72,.34,'X');
  brickWall(g,'room_partition',[0,-2.05,0],8.1,1.05,.28,'X',[1.45,1.15,.95]);
  doorLeaf(B('item_majlis_door'),2.06,-1.90,.02,.78,1.65,'X');
  for(const [x,y] of [[-3.95,-5.2],[-3.95,3.5],[3.95,3.5],[3.95,-5.2]]){const h=y>0?2.88:.72;B('room_architecture').cylinder([x,y,0],[x,y,h],.12,'palm',10,.10);}
  B('room_roof_edge').cylinder([-4.05,3.45,2.86],[4.05,3.45,2.86],.105,'palm',10);
  wovenMat(B,'item_mat',.63,.38,1.45,4.30);buildBed(g);
  wovenMat(B,'item_majlis_mat',-.65,-3.75,4.70,2.25);wovenMat(B,'item_majlis_rug',2.65,-3.75,1.10,2.20);
  B('item_majlis_seat').sphere([-2.95,-3.75,.18],[.68,1.05,.16],'fabric_red',22,9);
  pillow(B,'item_majlis_cushions',-3.15,-3.05,.38,1.05,.64,.34);pillow(B,'item_majlis_cushions',-3.15,-4.35,.36,.95,.62,.32);pillow(B,'item_majlis_cushions',2.85,-2.75,.36,.90,.62,.32);
  // The dark curtain follows the museum model and separates the two zones.
  const vertices=[],faces=[],rows=28,cols=9;
  for(let j=0;j<=rows;j++){const y=-1.85+j*(4.80/rows);for(let k=0;k<=cols;k++){const z=.10+k*(2.42/cols),x=-1.02+Math.sin(j*.74)*.025*(.35+.65*k/cols);vertices.push([x,y,z]);}}
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=j*(cols+1)+k;faces.push([a,a+1,a+cols+2,a+cols+1]);}
  B('item_divider').add(vertices,faces,'fabric_dark');
  for(let row=0;row<9;row++)for(let col=0;col<15;col++){if(row===8&&col%2)continue;const y=-1.70+col*.32,z=.27+row*.255;B('item_divider_dots').sphere([-.995,y,z],[.014,.025,.025],row%3===0?'fabric_cream':'shell',8,4);}
  for(const y of [-1.9,2.95]){B('item_divider_hardware').cylinder([-1.02,y,0],[-1.02,y,2.68],.058,'wood',10,.047);for(const z of [2.40,2.46,2.52])B('item_divider_hardware').torus([-1.02,y,z],.06,.01,'rope','Z',12,5);}
  B('item_divider_hardware').cylinder([-1.02,-1.9,2.52],[-1.02,2.95,2.52],.025,'rope',8);
  const graves=[
    ['item_grave_prophet',-2.02,1.55,1.10,1.68,.36],
    ['item_grave_abu_bakr',-2.55,.02,.98,1.46,.28],
    ['item_grave_umar',-2.78,-1.34,.88,1.24,.22]
  ];
  for(const [group,x,y,w,d,h] of graves){
    graveMound(B(group),x,y,w,d,h);B(group).sphere([x+.03,y+d*.32,h+.075],[.15,.12,.10],'mud_light',14,7);
    for(let j=0;j<8;j++){const xx=x+range(-w*.32,w*.32),yy=y+range(-d*.32,d*.32),s=range(.022,.052);B(group).sphere([xx,yy,h*.82],[s,s*.75,s*.48],'mud_dark',8,4);}
  }
  // Hanging leather waterskins on the side wall.
  for(const [i,yy] of [2.35,1.42,.49].entries()){
    const x=-3.67;B('item_waterskins').sphere([x,yy,.54],[.28,.36,.42],'leather',20,12);B('item_waterskins').sphere([x+.04,yy+.10,.72],[.22,.28,.29],'leather',18,10);
    B('item_waterskins').cylinder([x,yy+.22,.85],[x,yy+.32,1.05],.065,'leather',10,.055);B('item_waterskins').cylinder([x,yy+.32,1.04],[x,yy+.34,1.09],.07,'wood',10);
    B('item_waterskins').torus([x,yy,.58],.28,.016,'rope','Z',18,5);B('item_waterskins').cylinder([x,yy+.2,.98],[x+.08,yy+.44,1.28],.016,'rope',6);B('item_waterskins').cylinder([x+.08,yy+.44,1.28],[x+.12,yy+.5,.88],.016,'rope',6);
  }
  B('item_tanning_tools').box([-3.38,-4.58,.06],[.85,.62,.12],'leather_edge');B('item_tanning_tools').box([-3.38,-4.58,.135],[.76,.54,.035],'leather');
  for(let i=0;i<9;i++){const x=-3.70+i*.08;B('item_sant').cylinder([x,-4.82,.17],[x+range(-.08,.08),-4.34,.20],.018,'sant',6,.009);}
  // A tripod and a procedural fallback are replaced by the detailed jar asset when loaded.
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;B('item_water_jar_stand').cylinder([.02+Math.cos(a)*.29,1.95+Math.sin(a)*.29,.02],[.02+Math.cos(a)*.20,1.95+Math.sin(a)*.20,.52],.025,'metal',8);}
  B('item_water_jar').lathe([.02,1.95,.38],[[0,0],[.24,.02],[.36,.20],[.40,.55],[.34,.88],[.22,1.02],[.22,1.12],[.16,1.15],[.15,1.04]],'clay_light',32);
  B('item_water_jar').cylinder([.02,1.95,1.51],[.02,1.95,1.60],.12,'wood',16);
  // Reference-based custom models replace these two compact fallbacks in the majlis.
  B('item_quern').sphere([-1.0,-3.25,.15],[.48,.68,.13],'stone',22,10);B('item_quern').cylinder([-1.22,-3.49,.30],[-.76,-2.96,.40],.12,'stone_light',16,.10);
  B('item_rotary_mill').cylinder([.25,-4.35,.04],[.25,-4.35,.23],.34,'stone',28);B('item_rotary_mill').torus([.25,-4.35,.235],.27,.075,'stone_light');B('item_rotary_mill').cylinder([.25,-4.35,.20],[.25,-4.35,.26],.085,'shadow',18);B('item_rotary_mill').cylinder([.47,-4.35,.23],[.47,-4.35,.43],.025,'wood',8);
  B('item_basket').lathe([.75,-3.35,.02],[[0,0],[.28,0],[.36,.18],[.34,.52],[.27,.64],[0,.70]],'woven',28);
  for(let i=0;i<8;i++)B('item_basket_weave').torus([.75,-3.35,.07+i*.075],.28+Math.sin(i*.35)*.055,.012,i%3===0?'fabric_red':'woven_light','Z',24,5);
  openVessel(B('item_cooking_pot'),2.92,-4.35,.31,.43,'clay_dark');
  openVessel(B('item_cooking_bowls'),2.28,-4.75,.24,.20,'clay');openVessel(B('item_cooking_bowls'),3.46,-3.65,.20,.17,'clay_dark');openVessel(B('item_cooking_bowls'),2.42,-3.82,.18,.15,'clay_light');
  B('item_tray').lathe([2.52,-2.85,.025],[[0,0],[.43,0],[.46,.06],[.46,.10],[.41,.075],[0,.045]],'clay_light',32);
  B('item_bucket').lathe([3.40,-.55,.02],[[0,0],[.26,0],[.29,.48],[.25,.52],[.22,.48],[.21,.08],[0,.08]],'woven',24);
  for(let i=0;i<5;i++)B('item_bucket_binding').torus([3.40,-.55,.08+i*.095],.25+i*.006,.014,'rope','Z',20,5);
  B('item_bucket_binding').torus([3.40,-.55,.56],.31,.018,'rope','Y',24,6);
  openVessel(B('item_cup'),1.55,-3.50,.22,.34,'metal');
  B('item_fleece').sphere([1.13,-.42,.075],[.48,.86,.065],'wool',22,9);
  for(let i=0;i<38;i++){const a=range(0,Math.PI*2),r=range(.15,.48);B('item_fleece').sphere([1.13+Math.cos(a)*r,-.42+Math.sin(a)*r*1.6,.12],[.045,.05,.045],'wool',8,4);}
  const staff=[[-.45,3.25,.03],[-.38,3.20,.65],[-.28,3.18,1.28],[-.35,3.17,1.82],[-.52,3.16,2.02]];
  for(let i=0;i<staff.length-1;i++)B('item_staff').cylinder(staff[i],staff[i+1],.027,'wood',8,.023);
  for(let i=0;i<11;i++){const x=3.45+i*.035;B('item_sant_bundle').cylinder([x,2.95,.02],[x+range(-.12,.12),3.20,1.85+range(-.15,.15)],.018,'sant',6,.009);}
  // Open wooden door at the majlis entrance, kept low in the cutaway sightline.
  B('item_door').box([2.65,-5.14,.38],[1.12,.13,.76],'door');
  for(const x of [2.22,2.52,2.82,3.12])B('item_door_planks').box([x,-5.22,.38],[.025,.035,.72],'wood');
  for(let i=0;i<110;i++){const x=range(-3.75,3.75),y=range(-5.05,3.30),s=range(.012,.038);B('room_floor_details').sphere([x,y,.015],[s,s*.72,s*.38],choose(['mud_dark','mud_light','stone']),7,4);}
  return flush(g);
}
