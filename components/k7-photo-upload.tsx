"use client";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
async function optimize(file:File){
  if(file.size>25*1024*1024)throw Error("Максимальный размер исходной фотографии — 25 МБ");
  const url=URL.createObjectURL(file);try{
    const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error("Не удалось открыть фото");
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");if(!ctx)throw Error("Обработка фото недоступна");ctx.fillStyle="#000";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.84));if(!blob||blob.size>2*1024*1024)throw Error("Не удалось сжать фотографию");return blob;
  }finally{URL.revokeObjectURL(url);}
}
export function K7PhotoUpload({onUpload,max=1,disabled=false,onBusy}:{onUpload:(urls:string[])=>void;max?:number;disabled?:boolean;onBusy?:(busy:boolean)=>void}){
  const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function upload(files:FileList|null){if(!files||busy||disabled)return;setBusy(true);onBusy?.(true);setError("");const urls:string[]=[];try{for(const file of Array.from(files).slice(0,max)){const image=await optimize(file);const res=await fetch("/api/community/media",{method:"POST",credentials:"include",headers:{"Content-Type":"image/jpeg"},body:image});const data=await res.json();if(!res.ok||!data.success)throw Error(data.error||"Ошибка загрузки");urls.push(data.url);}}catch(e){setError(e instanceof Error?e.message:"Ошибка загрузки");}finally{if(urls.length)onUpload(urls);setBusy(false);onBusy?.(false);if(input.current)input.current.value="";}}
  return <div className="k7-photo-upload"><input ref={input} type="file" accept="image/*" multiple={max>1} hidden onChange={e=>void upload(e.target.files)}/><button type="button" className="k7-panel-button" onClick={()=>input.current?.click()} disabled={disabled||busy||max<1}><ImagePlus size={16}/>{busy?"Загрузка…":"Добавить фото"}</button>{error&&<small role="alert">{error}</small>}</div>;
}
