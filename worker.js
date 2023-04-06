importScripts("./opencv.js");function HTMLImageElement(){}function HTMLCanvasElement(e){this.width=e.width,this.height=e.height,this.data=e,this.getContext=()=>({getImageData:()=>this.data})}const findCounters=e=>{if(e.counters)return e.counters;cv.cvtColor(e,e,cv.COLOR_RGBA2GRAY,0),cv.Sobel(e,e,cv.CV_8U,1,0,3),cv.threshold(e,e,0,255,cv.THRESH_OTSU+cv.THRESH_BINARY);const l=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(5,5)),o=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(10,10));cv.dilate(e,e,o),cv.erode(e,e,l),cv.Canny(e,e,10,10);const c=new cv.MatVector,a=new cv.Mat;cv.findContours(e,c,a,cv.RETR_CCOMP,cv.CHAIN_APPROX_SIMPLE);const s=[];for(let r=0;r<c.size();++r){const h=cv.minAreaRect(c.get(r));s.push(h)}return c.delete(),a.delete(),e.counters=s,e.counters},getOffsetInfo=(e,l)=>{const o=findCounters(e),c=findCounters(l),a=t=>`${t.center.x}_${t.size.width}_${t.size.height}_${t.angle}`,s={};let r=0,h=0;const i=o.filter(t=>{const u=(n,f)=>Math.abs(n.center.y-f.center.y),v=c.filter(n=>a(t)===a(n)).sort((n,f)=>u(n,t)-u(f,t));if(v.length){t.match=v[0];const n=v[0].center.y-t.center.y;return t.distance=n,n&&(s[n]?s[n]+=1:s[n]=1,s[n]>r&&(r=s[n],h=n)),!0}return!1});if(i.filter(t=>!t.distance).length>i.length*.9)return{y1:0,y2:0,counters1:o,counters2:c};const d=i.filter(t=>t.distance===h).sort((t,u)=>t.center.y-u.center.y);return d.length&&d.length>.1*i.length?{y1:d[0].center.y,y2:d[0].match.center.y,counters1:o,counters2:c}:{y1:0,y2:0,counters1:o,counters2:c}};self.addEventListener("message",function(e){if(e.data&&e.data.method==="getOffsetInfo"){const{data1:l,data2:o,counters1:c,counters2:a}=e.data.args,s=new HTMLCanvasElement(l),r=cv.imread(s);r.counters=c;const h=new HTMLCanvasElement(o),i=cv.imread(h);i.counters=a;const y=getOffsetInfo(r,i);self.postMessage(y)}},!1);
