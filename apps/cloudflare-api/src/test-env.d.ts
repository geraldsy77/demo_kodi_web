declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('@cloudflare/vitest-pool-workers').D1Migration[];
    SYNC_TOKEN: string;
    SYNC_STALE_AFTER_SECONDS: string;
  }
}
