// supabase/functions/_shared/cors.ts
const allowedHeaders = 'authorization, content-type, apikey, x-client-info, x-supabase-api-version';

export const setCORSHeaders = (headers: Headers) => {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', allowedHeaders);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
};

export const handleOPTIONS = (): Response => {
  const headers = new Headers();
  setCORSHeaders(headers);
  return new Response(null, { status: 200, headers });
};