import Tags from 'lucide-icons/tags.js';
import Info from 'lucide-icons/info.js';
import CircleHelp from 'lucide-icons/circle-help.js';
import X from 'lucide-icons/x.js';
import Bookmark from 'lucide-icons/bookmark.js';
import BookOpen from 'lucide-icons/book-open.js';
import MousePointer2 from 'lucide-icons/mouse-pointer-2.js';
import Landmark from 'lucide-icons/landmark.js';
import DoorOpen from 'lucide-icons/door-open.js';
import RotateCcw from 'lucide-icons/rotate-ccw.js';
import ScrollText from 'lucide-icons/scroll-text.js';
import TriangleAlert from 'lucide-icons/triangle-alert.js';
import Download from 'lucide-icons/download.js';
import ArrowLeft from 'lucide-icons/arrow-left.js';
import RotateCw from 'lucide-icons/rotate-cw.js';
import Award from 'lucide-icons/award.js';
import Utensils from 'lucide-icons/utensils.js';

export const ICONS={Tags,Info,CircleHelp,X,Bookmark,BookOpen,MousePointer2,Landmark,DoorOpen,RotateCcw,ScrollText,TriangleAlert,Download,ArrowLeft,RotateCw,Award,Utensils};
const SVG_NS='http://www.w3.org/2000/svg';
const pascalCase=value=>value.replace(/(^|[-_\s])(\w)/g,(_,__,letter)=>letter.toUpperCase());
function appendNodes(parent,nodes){
  for(const [tag,attributes,children] of nodes){
    const element=document.createElementNS(SVG_NS,tag);
    for(const [name,value] of Object.entries(attributes||{}))element.setAttribute(name,String(value));
    if(children)appendNodes(element,children);parent.appendChild(element);
  }
}
export function createIcons({icons=ICONS,attrs={}}={}){
  for(const element of document.querySelectorAll('i[data-lucide]')){
    const name=element.getAttribute('data-lucide'),icon=icons[pascalCase(name)];if(!icon)continue;
    const [,defaultAttributes,children]=icon,svg=document.createElementNS(SVG_NS,'svg');
    const attributes={...defaultAttributes,...attrs,'data-lucide':name,class:`lucide lucide-${name} ${element.getAttribute('class')||''}`.trim()};
    for(const [key,value] of Object.entries(attributes))svg.setAttribute(key,String(value));
    appendNodes(svg,children);element.replaceWith(svg);
  }
}
