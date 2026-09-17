import { createClient } from "@supabase/supabase-js";
export function supabaseAdmin(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase server environment is not configured");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export const bucket=()=>process.env.SUPABASE_STORAGE_BUCKET||"inspection-evidence";
export async function signedImageUrl(path:string){const {data,error}=await supabaseAdmin().storage.from(bucket()).createSignedUrl(path,300);if(error)throw error;return data.signedUrl}
