import { env } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';

async function main() {
  await connectDB();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
    // Calendar OAuth config at a glance in the deploy logs. Client IDs and the
    // public URL aren't secret; secrets are only reported as set/missing.
    // "length" exposes a stray character that a visual check would miss
    // (Microsoft/Azure client IDs are always 36 characters).
    const describeId = (id?: string) => (id ? `${id} (length ${id.length})` : 'MISSING');
    console.log('[config] BACKEND_PUBLIC_URL:', env.backendPublicUrl);
    console.log('[config] Google client ID:', describeId(env.googleOAuthClientId), '| secret:', env.googleOAuthClientSecret ? 'set' : 'MISSING');
    console.log('[config] Microsoft client ID:', describeId(env.microsoftOAuthClientId), '| secret:', env.microsoftOAuthClientSecret ? 'set' : 'MISSING');
  });
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
