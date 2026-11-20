import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../chatgpt-auth';
export const db = () => { if (!env.DB) throw new Error('Database unavailable'); return env.DB; };
export const bucket = () => { if (!env.BUCKET) throw new Error('Storage unavailable'); return env.BUCKET; };
export async function identity() {
 const user = await getChatGPTUser();
 const email = (env as unknown as {ADMIN_EMAIL?:string}).ADMIN_EMAIL;
 const admin = !!user && !!email && user.email.toLowerCase() === email.toLowerCase();
 const member = user ? await db().prepare('SELECT * FROM members WHERE id=?').bind(user.userId).first<any>() : null;
 return { user, admin, member, allowed: admin || member?.status === 'approved' };
}
export function json(data:unknown, status=200) { return Response.json(data, {status, headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}}); }
export function validOrigin(request:Request) {
 return request.headers.get('origin') === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
