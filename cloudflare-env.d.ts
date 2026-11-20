declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_EMAIL?:string;
    VAPID_PUBLIC_KEY?:string;
    VAPID_PRIVATE_KEY?:string;
    BUCKET?: R2Bucket;
  }
}
