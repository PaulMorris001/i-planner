import path from 'path';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  // Default 100kb limit is too small for a base64-encoded syllabus PDF
  // (syllabus.controller.ts's extract endpoint) — base64 inflates size ~33%.
  app.use(express.json({ limit: '15mb' }));

  // Public legal pages (Terms of Use, Privacy Policy) — linked from the app's
  // paywall and from App Store Connect / Play Console. Resolved from
  // process.cwd() rather than __dirname since ts-node-dev (src/) and the
  // compiled build (dist/) sit at different depths, but both run with
  // cwd = backend/ (same pattern as certs/ in services/appStoreVerify.ts).
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use('/api', router);

  app.use(errorHandler);

  return app;
}
