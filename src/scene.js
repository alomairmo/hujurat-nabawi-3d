import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createExteriorModel, createInteriorModel } from './procedural-models.js';
import { addCustomModels } from './custom-models.js';
import { createIcons, Tags, Info, CircleHelp, X, Bookmark, BookOpen, MousePointer2, Landmark, DoorOpen, RotateCcw, ScrollText, TriangleAlert, Download, ArrowLeft, RotateCw, Award, Utensils } from 'lucide';
import { EXTERIOR_ITEMS, INTERIOR_ITEMS, QUIZ_QUESTIONS } from './content.js';

const ICONS={Tags,Info,CircleHelp,X,Bookmark,BookOpen,MousePointer2,Landmark,DoorOpen,RotateCcw,ScrollText,TriangleAlert,Download,ArrowLeft,RotateCw,Award,Utensils};
const refreshIcons=()=>createIcons({icons:ICONS,attrs:{'aria-hidden':'true'}});
refreshIcons();
const $=(id)=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const CAPTURE_MODE=params.has('capture');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALL_ITEMS=[...EXTERIOR_ITEMS,...INTERIOR_ITEMS];
let currentView='exterior',currentStage=params.get('stage')==='after'?'after':'lifetime',selectedItemId=null,labelsVisible=true,currentItems=EXTERIOR_ITEMS;
let exteriorModel=null,interiorModel=null,labelButtons=[],renderer;
function mulberry32(a){return function(){a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rand=mulberry32(622);
try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(error){console.error('WebGL initialization failed',error);$('loading-screen').hidden=true;$('webgl-error').hidden=false;}
if(renderer)startExperience();

function startExperience(){
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.outputColorSpace=THREE.SRGBColorSpace;
  $('scene-container').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','مجسم ثلاثي الأبعاد؛ استخدم الأزرار والبطاقات للتنقل');
  const scene=new THREE.Scene(),horizon=new THREE.Color(0xd9c59f);scene.background=horizon;scene.fog=new THREE.Fog(horizon,85,220);
  const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.08,650);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!CAPTURE_MODE&&!reducedMotion;controls.dampingFactor=.075;controls.enablePan=false;controls.rotateSpeed=.62;controls.zoomSpeed=.75;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(390,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{topColor:{value:new THREE.Color(0x7797a0)},horizonColor:{value:horizon}},vertexShader:'varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',fragmentShader:'varying vec3 vWorld; uniform vec3 topColor; uniform vec3 horizonColor; void main(){ float h=clamp(normalize(vWorld).y*1.7,0.0,1.0); h=pow(h,0.72); gl_FragColor=vec4(mix(horizonColor,topColor,h),1.0); }'}));scene.add(sky);
  const hemi=new THREE.HemisphereLight(0xe8f0ed,0x7b4d2a,2.15);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe3b5,3);sun.position.set(-28,46,24);sun.castShadow=true;
  const shadowSize=innerWidth<700?1024:2048;sun.shadow.mapSize.set(shadowSize,shadowSize);
  Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:110});sun.shadow.normalBias=.045;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xb9d4d5,.65);fill.position.set(30,18,-25);scene.add(fill);
  const roomLight=new THREE.PointLight(0xffd49a,12,9,1.8);roomLight.position.set(0,2.3,.3);roomLight.visible=false;scene.add(roomLight);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(390,72).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0xa88758,roughness:1}));ground.position.y=-.69;ground.receiveShadow=true;scene.add(ground);
  const context=new THREE.Group(),contextGeometry=new THREE.BoxGeometry(1,1,1),contextMaterial=new THREE.MeshStandardMaterial({color:0x9a7a50,roughness:1});
  const contextMesh=new THREE.InstancedMesh(contextGeometry,contextMaterial,46),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<46;i++){const angle=(i/46)*Math.PI*2+rand()*.12,radius=62+rand()*92,h=2+rand()*4.5;position.set(Math.cos(angle)*radius,h/2-.62,Math.sin(angle)*radius);scale.set(4+rand()*8,h,4+rand()*8);matrix.compose(position,quaternion,scale);contextMesh.setMatrixAt(i,matrix);}context.add(contextMesh);scene.add(context);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),projected=new THREE.Vector3();
  let pointerStart={x:0,y:0},frameEMA=1/60,previousTime=performance.now(),frameCount=0,fps=60;
  function configureModel(model,isInterior){model.traverse((object)=>{if(!object.isMesh)return;object.castShadow=!object.name.startsWith('scene_base')&&!object.name.startsWith('room_architecture');object.receiveShadow=true;if(object.material)object.material.roughness=Math.max(object.material.roughness||0,.82);});model.visible=!isInterior;scene.add(model);}
  function setLoading(percent,text){$('loading-progress').style.width=`${percent}%`;if(text)$('loading-text').textContent=text;}
  async function loadModels(){
    try{
      setLoading(18,'تُبنى معالم المسجد والحُجُرات…');await new Promise(requestAnimationFrame);exteriorModel=createExteriorModel();configureModel(exteriorModel,false);
      setLoading(52,'تُجهّز الحجرة وأدواتها…');await new Promise(requestAnimationFrame);interiorModel=createInteriorModel();
      setLoading(70,'تُحمّل الرحى والسلة والزير المخصصة…');await addCustomModels(interiorModel);configureModel(interiorModel,true);
      setLoading(88,'تُرتّب البطاقات التعريفية…');const requestedView=['interior','tools'].includes(params.get('view'))?params.get('view'):'exterior';setView(requestedView,false);renderFrame();setLoading(100,'اكتمل المشهد');
      window.__SCENE_READY__=true;document.body.dataset.ready='true';
      if(CAPTURE_MODE)$('loading-screen').hidden=true;else setTimeout(()=>{$('loading-screen').classList.add('loaded');setTimeout(()=>{$('loading-screen').hidden=true;},reducedMotion?0:260);},reducedMotion?0:180);
      if(!CAPTURE_MODE)renderer.setAnimationLoop(animate);
    }catch(error){console.error('Model loading failed',error);$('loading-text').textContent='تعذّر تحميل ملفات المجسم. أعد تحميل الصفحة للمحاولة مرة أخرى.';$('loading-progress').style.width='100%';$('loading-progress').style.background='#c98265';}
  }
  function updateLabels(){
    if(!labelsVisible)return;
    const placed=[];
    for(const entry of labelButtons){
      projected.copy(entry.item.vector).project(camera);
      const visible=projected.z>-1&&projected.z<1&&projected.x>-1.08&&projected.x<1.08&&projected.y>-1.08&&projected.y<1.08;
      entry.button.style.opacity=visible?'1':'0';entry.button.style.pointerEvents=visible?'auto':'none';entry.button.tabIndex=visible?0:-1;
      if(!visible)continue;
      const offset=innerWidth<700?(entry.item.mobileOffset||[0,0]):[0,0];
      const anchorX=(projected.x*.5+.5)*innerWidth,anchorY=(-projected.y*.5+.5)*innerHeight;
      let x=anchorX+offset[0],y=anchorY-22+offset[1];
      const w=entry.button.offsetWidth||124,h=entry.button.offsetHeight||32;
      const collides=(xx,yy)=>placed.some(r=>Math.abs(xx-r.x)<(w+r.w)/2+5&&Math.abs(yy-r.y)<(h+r.h)/2+5);
      const baseY=y;let attempt=0;
      while(collides(x,y)&&attempt<7){attempt++;y=baseY+(attempt%2?-1:1)*Math.ceil(attempt/2)*(h+7);if(y<112)y=baseY+attempt*(h+7);}
      x=Math.max(w/2+8,Math.min(innerWidth-w/2-8,x));y=Math.max(96,Math.min(innerHeight-96,y));
      const dx=anchorX-x,dy=anchorY-y,length=Math.max(12,Math.hypot(dx,dy)),angle=Math.atan2(-dx,dy);
      entry.button.style.setProperty('--anchor-dx',`${dx}px`);entry.button.style.setProperty('--anchor-dy',`${dy}px`);
      entry.button.style.setProperty('--connector-length',`${length}px`);entry.button.style.setProperty('--connector-angle',`${angle}rad`);
      placed.push({x,y,w,h});entry.button.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
    }
  }
  function renderFrame(){controls.update();renderer.render(scene,camera);updateLabels();}
  function animate(now){const dt=Math.min((now-previousTime)/1000,.1);previousTime=now;if(dt>0)frameEMA=frameEMA*.96+dt*.04;frameCount++;if(frameCount%30===0)fps=Math.round(1/Math.max(frameEMA,.001));if(frameCount===180&&frameEMA>.034&&renderer.getPixelRatio()>1){renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);}renderFrame();}
  function resetCamera(){
    if(currentView==='exterior'){
      camera.fov=innerWidth<700?62:45;if(innerWidth<700)camera.position.set(78,62,80);else camera.position.set(52,41,53);controls.target.set(4,2.1,innerWidth<700?-1:1.5);controls.minDistance=34;controls.maxDistance=132;controls.minPolarAngle=.38;controls.maxPolarAngle=1.38;scene.fog.near=95;scene.fog.far=240;sun.intensity=3;hemi.intensity=2.15;roomLight.visible=false;
    }else if(currentView==='interior'){
      camera.fov=innerWidth<700?64:48;
      if(currentStage==='after'){if(innerWidth<700)camera.position.set(-12.0,16.8,14.2);else camera.position.set(-8.8,14.0,10.8);controls.target.set(-.85,.40,.45);}
      else{if(innerWidth<700)camera.position.set(13.8,15.0,16.2);else camera.position.set(10.2,11.8,13.2);controls.target.set(0,.55,.85);}
      controls.minDistance=7;controls.maxDistance=25;controls.minPolarAngle=.20;controls.maxPolarAngle=1.42;scene.fog.near=22;scene.fog.far=70;sun.intensity=1.45;hemi.intensity=1.9;roomLight.visible=true;
    }else{
      camera.fov=innerWidth<700?64:48;if(innerWidth<700)camera.position.set(12.4,13.0,14.6);else camera.position.set(8.4,8.8,10.8);controls.target.set(0,.50,1.0);controls.minDistance=5;controls.maxDistance=21;controls.minPolarAngle=.20;controls.maxPolarAngle=1.45;scene.fog.near=20;scene.fog.far=65;sun.intensity=1.35;hemi.intensity=1.85;roomLight.visible=true;
    }
    camera.updateProjectionMatrix();camera.lookAt(controls.target);controls.update();
  }
  function createLabels(){
    $('labels-layer').replaceChildren();labelButtons=currentItems.map((item)=>{item.vector=new THREE.Vector3(...item.position);const button=document.createElement('button');button.type='button';const labelKind=item.kind==='room'?'room-label':item.kind==='secondary'?'secondary-label':currentView==='exterior'?'feature-label':'detail-label';button.className=`scene-label ${labelKind}`;button.setAttribute('aria-label',`اعرض بطاقة ${item.name}`);button.dataset.item=item.id;const icon=document.createElement('i');icon.setAttribute('data-lucide','bookmark');const text=document.createElement('span');text.textContent=item.name;button.append(icon,text);button.addEventListener('click',()=>showInfo(item.id));$('labels-layer').appendChild(button);return{item,button};});refreshIcons();
  }
  const AFTER_OBJECTS=['item_divider','item_divider_dots','item_divider_hardware','item_grave_prophet','item_grave_abu_bakr','item_grave_umar'];
  function applyInteriorStage(){
    if(!interiorModel)return;
    const visible=currentStage==='after'&&currentView==='interior';
    for(const name of AFTER_OBJECTS){const object=interiorModel.getObjectByName(name);if(object)object.visible=visible;}
  }
  function syncStageUI(){
    $('stage-switch').hidden=currentView!=='interior';
    for(const [id,stage] of [['lifetime-stage','lifetime'],['burial-stage','after']]){$(id).classList.toggle('active',currentStage===stage);$(id).setAttribute('aria-pressed',String(currentStage===stage));}
  }
  function interiorEraText(){return currentStage==='after'?'غرفة النوم · بعد الوفاة والدفن':'غرفة النوم · في حياة النبي ﷺ';}
  function setStage(stage,userInitiated=true){
    currentStage=stage==='after'?'after':'lifetime';applyInteriorStage();syncStageUI();
    if(currentView==='interior')currentItems=INTERIOR_ITEMS.filter(item=>item.kind!=='tool'&&(currentStage==='after'||item.stage!=='after'));
    $('era-text').textContent=currentView==='interior'?interiorEraText():$('era-text').textContent;
    if(currentView==='interior')resetCamera();closeInfo();createLabels();const url=new URL(location.href);if(currentView==='interior'&&currentStage==='after')url.searchParams.set('stage','after');else url.searchParams.delete('stage');history.replaceState(null,'',url);if(userInitiated)renderFrame();
  }
  function setView(view,userInitiated=true){
    if(!['exterior','interior','tools'].includes(view))view='exterior';
    currentView=view;const inside=view!=='exterior';document.body.classList.toggle('interior-view',inside);
    currentItems=view==='exterior'?EXTERIOR_ITEMS:view==='tools'?INTERIOR_ITEMS.filter(item=>item.kind==='tool'):INTERIOR_ITEMS.filter(item=>item.kind!=='tool'&&(currentStage==='after'||item.stage!=='after'));
    if(exteriorModel)exteriorModel.visible=!inside;if(interiorModel)interiorModel.visible=inside;ground.visible=!inside;context.visible=!inside;sky.visible=!inside;scene.background=inside?new THREE.Color(0x4b3a29):horizon;applyInteriorStage();syncStageUI();
    for(const [id,name] of [['exterior-button','exterior'],['interior-button','interior'],['tools-button','tools']]){$(id).classList.toggle('active',view===name);$(id).setAttribute('aria-pressed',String(view===name));}
    $('view-hint').querySelector('span').textContent=view==='exterior'?'اسحب للتدوير · قرّب بعجلة الفأرة · اختر بطاقة للتفاصيل':view==='tools'?'أدوات المجلس وغرفة النوم · اختر أي تسمية لقراءة بطاقتها':'مجلس وغرفة نوم · بدّل مرحلة غرفة النوم من الأزرار العلوية';
    $('era-text').textContent=view==='exterior'?'تصوّر المسجد والحُجُرات · نحو ٧هـ':view==='tools'?'أدوات البيت · المجلس وغرفة النوم':interiorEraText();
    closeInfo();resetCamera();createLabels();const url=new URL(location.href);if(inside)url.searchParams.set('view',view);else url.searchParams.delete('view');if(view==='interior'&&currentStage==='after')url.searchParams.set('stage','after');else url.searchParams.delete('stage');history.replaceState(null,'',url);if(userInitiated&&CAPTURE_MODE)renderFrame();
  }
  function showInfo(id){const item=ALL_ITEMS.find((entry)=>entry.id===id);if(!item)return;selectedItemId=id;$('info-title').textContent=item.name;$('info-description').textContent=item.description;$('info-source').textContent=item.source;$('info-note').hidden=!item.note;$('info-note').textContent=item.note||'';$('info-panel').hidden=false;labelButtons.forEach((entry)=>entry.button.classList.toggle('selected',entry.item.id===id));refreshIcons();}
  function closeInfo(){selectedItemId=null;$('info-panel').hidden=true;labelButtons.forEach((entry)=>entry.button.classList.remove('selected'));}
  function objectMatches(object,item){return[item.object,...(item.alternateObjects||[])].some((name)=>object.name===name||object.name.startsWith(`${name}_`));}
  function pickObject(event){if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const model=currentView==='exterior'?exteriorModel:interiorModel;if(!model)return;const pickableItems=currentView==='exterior'?EXTERIOR_ITEMS:INTERIOR_ITEMS.filter(item=>currentStage==='after'||item.stage!=='after');for(const hit of raycaster.intersectObject(model,true)){let object=hit.object;while(object){const item=pickableItems.find((entry)=>objectMatches(object,entry));if(item){showInfo(item.id);return;}object=object.parent;}}}
  renderer.domElement.addEventListener('pointerdown',(event)=>{pointerStart={x:event.clientX,y:event.clientY};});renderer.domElement.addEventListener('pointerup',pickObject);
  controls.addEventListener('change',()=>{if(CAPTURE_MODE){renderer.render(scene,camera);updateLabels();}});
  $('exterior-button').addEventListener('click',()=>setView('exterior'));$('interior-button').addEventListener('click',()=>setView('interior'));$('tools-button').addEventListener('click',()=>setView('tools'));$('lifetime-stage').addEventListener('click',()=>setStage('lifetime'));$('burial-stage').addEventListener('click',()=>setStage('after'));$('reset-button').addEventListener('click',()=>{resetCamera();renderFrame();});
  $('labels-toggle').addEventListener('click',()=>{labelsVisible=!labelsVisible;$('labels-layer').hidden=!labelsVisible;$('labels-toggle').setAttribute('aria-pressed',String(labelsVisible));$('labels-toggle').setAttribute('aria-label',labelsVisible?'إخفاء البطاقات':'إظهار البطاقات');});
  $('info-close').addEventListener('click',closeInfo);$('about-button').addEventListener('click',()=>$('about-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach((button)=>button.addEventListener('click',()=>$(button.dataset.close).close()));document.querySelectorAll('dialog').forEach((dialog)=>dialog.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close();}));document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!$('info-panel').hidden)closeInfo();});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=currentView==='exterior'?(innerWidth<700?62:45):(innerWidth<700?62:48);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderFrame();});
  window.__SCENE_READY__=false;window.__seek=()=>renderFrame();window.__play=()=>{};window.__setView=(view)=>{setView(view);renderFrame();};window.__setStage=(stage)=>{setStage(stage);renderFrame();};window.__selectItem=(id)=>{showInfo(id);renderFrame();};window.__getMetrics=()=>({view:currentView,stage:currentStage,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps,pixelRatio:renderer.getPixelRatio(),labels:labelButtons.length,selectedItemId});
  setupQuiz();loadModels();
}

function setupQuiz(){
  let index=0,score=0,answered=false;const dialog=$('quiz-dialog'),content=$('quiz-content');const arabicNumber=(value)=>String(value).replace(/\d/g,(digit)=>'٠١٢٣٤٥٦٧٨٩'[digit]);
  function renderIntro(){index=0;score=0;answered=false;content.innerHTML=`<div class="quiz-hero"><div class="quiz-symbol"><i data-lucide="circle-help"></i></div><div class="panel-kicker">ستة أسئلة قصيرة</div><h2 id="quiz-title">اختبر معرفتك</h2><p>راجع أسماء العناصر التي رأيتها في المسجد والحجرة. ستحصل على تصحيح وشرح مختصر بعد كل إجابة.</p><button class="button button-primary quiz-start" id="quiz-start" type="button">ابدأ الاختبار<i data-lucide="arrow-left"></i></button></div>`;$('quiz-start').addEventListener('click',renderQuestion);refreshIcons();}
  function renderQuestion(){answered=false;const question=QUIZ_QUESTIONS[index];content.innerHTML=`<div class="quiz-meta"><span>السؤال ${arabicNumber(index+1)} من ${arabicNumber(QUIZ_QUESTIONS.length)}</span><span>النقاط: ${arabicNumber(score)}</span></div><div class="quiz-progress" aria-hidden="true"><span style="width:${((index+1)/QUIZ_QUESTIONS.length)*100}%"></span></div><h2 id="quiz-title" class="quiz-question">${question.question}</h2><div class="quiz-options">${question.options.map((option,optionIndex)=>`<button class="quiz-option" type="button" data-option="${optionIndex}"><span class="option-letter">${['أ','ب','ج'][optionIndex]}</span><span>${option}</span></button>`).join('')}</div><div id="quiz-feedback" aria-live="polite"></div>`;content.querySelectorAll('[data-option]').forEach((button)=>button.addEventListener('click',()=>answerQuestion(Number(button.dataset.option))));}
  function answerQuestion(optionIndex){if(answered)return;answered=true;const question=QUIZ_QUESTIONS[index],correct=optionIndex===question.answer;if(correct)score++;content.querySelectorAll('[data-option]').forEach((button)=>{const value=Number(button.dataset.option);button.disabled=true;if(value===question.answer)button.classList.add('correct');if(value===optionIndex&&!correct)button.classList.add('wrong');});$('quiz-feedback').innerHTML=`<div class="quiz-feedback"><strong>${correct?'إجابة صحيحة.':'ليست الإجابة الصحيحة.'}</strong> ${question.explanation}</div><button id="quiz-next" class="button button-primary quiz-next" type="button">${index===QUIZ_QUESTIONS.length-1?'اعرض النتيجة':'السؤال التالي'}<i data-lucide="arrow-left"></i></button>`;$('quiz-next').addEventListener('click',()=>{if(index===QUIZ_QUESTIONS.length-1)renderResult();else{index++;renderQuestion();}});refreshIcons();$('quiz-next').focus();}
  function renderResult(){const message=score===QUIZ_QUESTIONS.length?'أحسنت، أجبت عن جميع الأسئلة.':score>=4?'معرفة طيبة؛ راجع البطاقات التي فاتتك وجرّب مرة أخرى.':'جولة أخرى بين البطاقات ستساعدك على تثبيت الأسماء.';content.innerHTML=`<div class="quiz-result"><div class="quiz-symbol" style="margin-inline:auto"><i data-lucide="award"></i></div><h2 id="quiz-title">نتيجتك</h2><div class="score-ring"><div><strong>${arabicNumber(score)}</strong><span>من ${arabicNumber(QUIZ_QUESTIONS.length)}</span></div></div><p>${message}</p><div class="result-actions"><button id="quiz-retry" class="button button-primary" type="button"><i data-lucide="rotate-cw"></i>أعد الاختبار</button><button id="quiz-explore" class="button button-quiet" type="button"><i data-lucide="bookmark"></i>عد إلى البطاقات</button></div></div>`;$('quiz-retry').addEventListener('click',renderIntro);$('quiz-explore').addEventListener('click',()=>dialog.close());refreshIcons();}
  $('quiz-button').addEventListener('click',()=>{renderIntro();dialog.showModal();});
}
