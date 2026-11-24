import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const viewer=await getAuthenticatedUser();if(!viewer)return new NextResponse(null,{status:401});
  const {id}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new NextResponse(null,{status:404});
  try{const {data,error}=await getSupabaseAdmin().storage.from("k7-publications").download(`${id}.jpg`);if(error||!data)return new NextResponse(null,{status:404});return new NextResponse(await data.arrayBuffer(),{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});}catch{return new NextResponse(null,{status:503});}
}
