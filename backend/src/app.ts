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

  app.use('/api', router);

  app.use(errorHandler);

  return app;
}
