import { env } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';

async function main() {
  await connectDB();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
