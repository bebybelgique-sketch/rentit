// supabase/functions/_shared/json.ts
import { setCORSHeaders } from './cors.ts';

export const json = (data: any, status: number = 200) => {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  setCORSHeaders(headers);
  return new Response(JSON.stringify(data), { status, headers });
};