/** Protected delivery. No private keys, registry paths or public file URLs reach clients. */
type Result = { data: Record<string, unknown> | null; error?: unknown };
type Query = { select(columns: string): Query; eq(column: string, value: unknown): Query; maybeSingle(): PromiseLike<Result> };
type Options = { auth: { persistSession: boolean; autoRefreshToken: boolean }; global?: { headers: Record<string, string> } };
type Client = {
  auth: { getUser(token: string): PromiseLike<{data: {user: {id: string} | null}; error?: unknown}> };
  from(table: string): Query;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error?: unknown}>;
  storage: {from(bucket: string): {download(path: string): PromiseLike<{data: Blob | null; error?: unknown}>}};
};
type Dependencies = {
  env(name: string): string | undefined;
  createClient(url: string, key: string, options: Options): Client;
  log(message: string, error?: unknown): void;
};
const BUCKET = 'bp-reading-editions';
const productionOrigins = ['https://blackwoodpublishing.co.uk','https://www.blackwoodpublishing.co.uk','https://aidanb1982.github.io'];

export function createReadingHandler(deps: Dependencies) {
  const allowedOrigins = new Set(productionOrigins);
  for (const value of (deps.env('BP_READING_ALLOWED_ORIGINS') || '').split(',')) {
    const origin = value.trim();
    if (!origin) continue;
    try { const url = new URL(origin); if (url.protocol === 'https:' && url.origin === origin) allowedOrigins.add(origin); }
    catch { deps.log('Ignoring an invalid BP Reading origin.'); }
  }
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers: Record<string,string> = {
      'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Expose-Headers':'Content-Length',
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
      'Vary':'Origin'
    };
    if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const fail = (status: number, error: string) => new Response(JSON.stringify({ok:false,error}), {status,headers:{...headers,'Content-Type':'application/json'}});
    if (origin && !allowedOrigins.has(origin)) return fail(403,'This origin is not allowed.');
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return fail(405,'Method not allowed.');
    try {
      const url = deps.env('SUPABASE_URL');
      const anonKey = deps.env('SUPABASE_ANON_KEY');
      const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !anonKey || !serviceKey) return fail(500,'Reader service is not configured.');
      const authorization = request.headers.get('Authorization') || '';
      const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
      if (!token || token.length > 8192) return fail(401,'A signed-in session is required.');
      const declaredSize = Number(request.headers.get('Content-Length'));
      if (declaredSize > 4096) return fail(413,'The reader request is too large.');
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 4096) return fail(413,'The reader request is too large.');
      let body: unknown;
      try {body = JSON.parse(raw);} catch {return fail(400,'Invalid JSON request.');}
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400,'Invalid request body.');
      const editionId = (body as Record<string,unknown>).editionId;
      if (typeof editionId !== 'number' || !Number.isSafeInteger(editionId) || editionId <= 0) return fail(400,'A valid numeric editionId is required.');
      const auth = {persistSession:false,autoRefreshToken:false};
      const userClient = deps.createClient(url,anonKey,{auth,global:{headers:{Authorization:`Bearer ${token}`}}});
      const {data:userData,error:userError} = await userClient.auth.getUser(token);
      if (userError || !userData.user) return fail(401,'The signed-in session could not be verified.');
      const service = deps.createClient(url,serviceKey,{auth});
      const profile = await service.from('member_profiles').select('is_admin').eq('id',userData.user.id).maybeSingle();
      if (profile.error) return fail(500,'Account verification is unavailable.');
      const isAdmin = profile.data?.is_admin === true;
      if (!isAdmin) {
        // Remains closed until payment verification, releases and acceptance tests are complete.
        if (deps.env('BP_READING_CUSTOMER_ACCESS') !== 'true') return fail(403,'Reader membership access has not opened yet.');
        // Use the CALLER'S JWT. A service-role RPC cannot establish the user's entitlement.
        const access = await userClient.rpc('bp_reading_can_read',{p_edition_id:editionId});
        if (access.error) return fail(503,'Reader access could not be verified. Please try again.');
        if (access.data !== true) return fail(403,'An active membership or purchase of this book is required.');
      }
      const file = await service.from('bp_reading_files').select('edition_id,storage_bucket,storage_path,file_format,access_status').eq('edition_id',editionId).maybeSingle();
      if (file.error) return fail(503,'The reading edition could not be verified.');
      if (!file.data) return fail(404,'This reading edition is not available.');
      const record = file.data;
      // Preserve the supplied registry's known state without guessing its enum/check constraints.
      // Customers additionally require an explicit server-only release pinned to the exact file.
      if (record.access_status !== 'admin_testing') return fail(403,'This reading edition is not enabled.');
      if (record.storage_bucket !== BUCKET || record.file_format !== 'epub' || typeof record.storage_path !== 'string' || !record.storage_path.trim()) return fail(500,'The reading edition is incorrectly configured.');
      if (!isAdmin) {
        const release = await service.from('bp_reading_releases').select('storage_bucket,storage_path,enabled').eq('edition_id',editionId).maybeSingle();
        if (release.error) return fail(503,'The reading release could not be verified.');
        if (!release.data || release.data.enabled !== true || release.data.storage_bucket !== record.storage_bucket || release.data.storage_path !== record.storage_path) return fail(403,'This edition has not been released for members.');
      }
      const edition = await service.from('book_editions').select('id,format').eq('id',editionId).maybeSingle();
      if (edition.error) return fail(503,'The book edition could not be verified.');
      if (!edition.data || edition.data.format !== 'ebook') return fail(404,'This reading edition is not available.');
      const downloaded = await service.storage.from(BUCKET).download(record.storage_path);
      if (downloaded.error || !downloaded.data) return fail(404,'The reading file is not currently available.');
      const bytes = await downloaded.data.arrayBuffer();
      const signature = new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
      if (signature.length !== 4 || signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) return fail(500,'The stored reading file is invalid.');
      return new Response(bytes,{status:200,headers:{...headers,'Content-Type':'application/epub+zip','Content-Disposition':'inline','Content-Length':String(bytes.byteLength)}});
    } catch (error) {
      deps.log('BP Reading delivery failed.',error);
      return fail(500,'The reading service encountered an error.');
    }
  };
}
