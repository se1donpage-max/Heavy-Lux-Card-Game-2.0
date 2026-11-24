import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canManageContent } from "@/lib/permissions";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>NextResponse.json({success:false,error},{status});
export async function POST(request:NextRequest){
  const viewer=await getAuthenticatedUser();if(!viewer)return fail("Необходима авторизация",401);if(!canManageContent(viewer.accessRole))return fail("Недостаточно прав",403);
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>3*1024*1024)return fail("Файл слишком большой",413);
    // Client sends an optimized JPEG as a raw body. Read a bounded stream, not multipart.
    const reader=request.body?.getReader();if(!reader)return fail("Файл не получен",400);
    const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();return fail("Файл слишком большой",413);}chunks.push(value);}
    const input=Buffer.concat(chunks);if(input[0]!==0xff||input[1]!==0xd8)return fail("Требуется JPEG",400);
    let bytes:Buffer;try{bytes=await sharp(input,{limitInputPixels:20000000,failOn:"error"}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).jpeg({quality:82,mozjpeg:true}).toBuffer();}catch{return fail("Не удалось прочитать фотографию",400);}
    if(bytes.length>2*1024*1024)return fail("Фотография слишком большая",413);
    const id=randomUUID();const {error}=await getSupabaseAdmin().storage.from("k7-publications").upload(`${id}.jpg`,bytes,{contentType:"image/jpeg",upsert:false});if(error)throw error;
    return NextResponse.json({success:true,url:`/api/community/media/${id}`},{status:201});
  }catch(error){console.error("K7 media upload",error);return fail("Не удалось загрузить фотографию",503);}
}
