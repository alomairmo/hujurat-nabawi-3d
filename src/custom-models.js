import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URLS={
  water_jar:new URL('./assets/jar.glb.b64',import.meta.url).href,
  quern:new URL('./assets/quern.glb.b64',import.meta.url).href,
  basket:new URL('./assets/basket.glb.b64',import.meta.url).href
};

async function loadEmbeddedModel(loader,url){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`تعذر تحميل النموذج المخصص: ${response.status}`);
  const encoded=(await response.text()).replace(/\s/g,'');
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const gltf=await loader.parseAsync(bytes.buffer,'');
  return gltf.scene;
}

function normalizeAsset(object,targetHeight){
  object.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error('المجسم المخصص بلا أبعاد صالحة');
  object.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
  const wrapper=new THREE.Group();wrapper.add(object);wrapper.scale.setScalar(targetHeight/size.y);
  wrapper.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  return wrapper;
}
function install(interior,name,object,position,rotation=0){
  const previous=interior.getObjectByName(name);if(previous)interior.remove(previous);
  object.name=name;object.position.set(...position);object.rotation.y=rotation;interior.add(object);
}
export async function addCustomModels(interior){
  const loader=new GLTFLoader();
  const jobs=[
    {name:'item_water_jar',position:[.02,.38,-1.95],height:1.18,rotation:.25,color:0xa66946,load:()=>loadEmbeddedModel(loader,MODEL_URLS.water_jar)},
    {name:'item_quern',position:[-1.0,.02,3.25],height:.40,rotation:-.38,color:0x918c7d,load:()=>loadEmbeddedModel(loader,MODEL_URLS.quern)},
    {name:'item_basket',position:[.75,.02,3.35],height:.72,rotation:.30,color:0x9b6e41,load:()=>loadEmbeddedModel(loader,MODEL_URLS.basket)}
  ];
  const results=await Promise.allSettled(jobs.map(async job=>{
    const source=await job.load();
    source.traverse(node=>{if(node.isMesh)node.material=new THREE.MeshStandardMaterial({color:job.color,roughness:.88});});
    install(interior,job.name,normalizeAsset(source,job.height),job.position,job.rotation);
  }));
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length)console.warn('استُخدمت البدائل الإجرائية لبعض الأدوات المخصصة:',failed.map(result=>result.reason?.message||'خطأ غير معروف'));
  return results.every(result=>result.status==='fulfilled');
}
