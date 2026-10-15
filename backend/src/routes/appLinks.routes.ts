import { Router } from 'express';
import { env } from '../config/env';
import { ANDROID_PACKAGE, IOS_BUNDLE_ID } from '../constants/appLinks';

// What lets a tapped https link open the app directly instead of the browser: iOS "Universal
// Links" and Android "App Links". Each phone downloads one of these files from the link's domain
// and checks that it names this app. They must be served over HTTPS with no redirect.
//
// Paths below are the ones the app handles: /r/<referral code>.
export const appLinksRouter = Router();

const LINK_PATHS = ['/r/*'];

// iOS. Needs the Apple Team ID (App Store Connect → Membership) in APPLE_TEAM_ID.
appLinksRouter.get('/apple-app-site-association', (_req, res) => {
  if (!env.appleTeamId) {
    res.status(404).json({ error: 'APPLE_TEAM_ID is not set.' });
    return;
  }
  const appId = `${env.appleTeamId}.${env.appleBundleId ?? IOS_BUNDLE_ID}`;
  res.type('application/json').json({
    applinks: {
      details: [
        // iOS 13+
        { appIDs: [appId], components: LINK_PATHS.map((path) => ({ '/': path })) },
        // older iOS
        { appID: appId, paths: LINK_PATHS },
      ],
    },
  });
});

// Android. Needs the SHA-256 fingerprint of every key the installed app can be signed with, in
// ANDROID_CERT_SHA256 (comma-separated): the EAS upload keystore AND, if the app comes from Google
// Play, Play's app-signing key.
appLinksRouter.get('/assetlinks.json', (_req, res) => {
  if (!env.androidCertSha256.length) {
    res.status(404).json({ error: 'ANDROID_CERT_SHA256 is not set.' });
    return;
  }
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: env.androidCertSha256,
      },
    },
  ]);
});
