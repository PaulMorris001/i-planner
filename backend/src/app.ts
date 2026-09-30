import path from 'path';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { router } from './routes';
import { sharedNoteWebRouter } from './routes/sharedNoteWeb.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  // Default 100kb limit is too small for a base64-encoded syllabus upload (base64
  // inflates size ~33%) — sized for more than a text-heavy PDF now that the syllabus
  // picker also accepts a full-resolution phone camera photo, which can run well
  // into the 10-20MB range before encoding.
  app.use(express.json({ limit: '30mb' }));

  // Legal pages for paywall / App Store Connect / Play Console.
  // Uses cwd (not __dirname) since src/ and dist/ differ in depth but both run with cwd = backend/.
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Microsoft Entra publisher-domain verification for the Outlook Calendar app
  // registration ("i-Planner", Branding & properties → Publisher domain).
  // Explicit route because express.static above skips dot-folders like
  // /.well-known. Must stay reachable over HTTPS with no redirect, or the
  // domain loses its verified status.
  app.get('/.well-known/microsoft-identity-association.json', (_req, res) => {
    res.json({
      associatedApplications: [{ applicationId: '60efc113-00c8-4b41-bcc0-d98a36fa4b57' }],
    });
  });

  // Public, browser-facing note-share preview pages — see
  // routes/sharedNoteWeb.routes.ts for why this isn't under /api.
  app.use('/shared', sharedNoteWebRouter);

  app.use('/api', router);

  app.use(errorHandler);

  return app;
}
