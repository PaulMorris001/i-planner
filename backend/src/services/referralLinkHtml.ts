import { APP_STORE_URL, PLAY_STORE_URL, escapeHtml } from './sharedNoteHtml';
import { ANDROID_PACKAGE, APP_SCHEME } from '../constants/appLinks';
import { env } from '../config/env';

export type ReferralPlatform = 'ios' | 'android' | 'other';

// Which kind of phone opened the link. Anything that isn't clearly an iPhone/iPad or Android phone
// (a laptop, a link-preview bot) gets the page with both store links.
export function platformFromUserAgent(userAgent: string | undefined): ReferralPlatform {
  const ua = userAgent ?? '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

// Google Play passes this back to the app after install (Play Install Referrer), which is how a
// friend's code survives the trip through the store on Android.
export function playStoreUrlWithCode(code: string): string {
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`ref=${code}`)}`;
}

// Chrome on Android: opens the app if it is installed, otherwise goes to the store listing.
export function androidIntentUrl(code: string): string {
  const fallback = encodeURIComponent(playStoreUrlWithCode(code));
  return `intent://r/${code}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

const STYLES = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #F7F7FB; color: #0F0E2A; }
  .card { max-width: 460px; margin: 0 auto; background: #fff; border: 1px solid #E4E3EF; border-radius: 22px;
    padding: 28px 24px; text-align: center; }
  .logo { width: 64px; height: 64px; border-radius: 16px; }
  h1 { font-size: 22px; margin: 16px 0 6px; }
  p { font-size: 15px; line-height: 1.55; color: #6B6A80; margin: 6px 0; }
  .code-label { margin-top: 22px; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #A8A7BE; }
  .code { margin-top: 6px; font-size: 30px; font-weight: 800; letter-spacing: 6px; color: #0F0E2A; }
  .copy { margin-top: 10px; background: none; border: 1.5px solid #3B82F6; color: #3B82F6; font-weight: 700;
    font-size: 13px; border-radius: 999px; padding: 8px 18px; cursor: pointer; }
  .primary { display: block; margin-top: 22px; background: #3B82F6; color: #fff; font-weight: 700; text-decoration: none;
    padding: 15px; border-radius: 999px; font-size: 16px; box-shadow: 0 6px 16px rgba(59,130,246,0.28); }
  .secondary { display: block; margin-top: 12px; color: #3B82F6; text-decoration: none; font-weight: 600; font-size: 14px; }
  .stores { margin-top: 14px; font-size: 13px; color: #6B6A80; }
  .stores a { color: #3B82F6; font-weight: 600; text-decoration: none; }
  .hint { margin-top: 18px; font-size: 12.5px; color: #A8A7BE; }
  @media (prefers-color-scheme: dark) {
    body { background: #121212; color: #e8e8e8; }
    .card { background: #1c1c22; border-color: #2c2c36; }
    p, .stores { color: #a8a7be; }
    .code { color: #fff; }
  }
`;

// The page a friend lands on when the app did not open straight away: the invitation, the code
// (so it can be typed in by hand if nothing else works), and the right store for their phone.
export function buildReferralLandingPage(code: string, platform: ReferralPlatform): string {
  const safeCode = escapeHtml(code);
  const shown = `${safeCode.slice(0, 4)} ${safeCode.slice(4)}`;
  const openApp = `${APP_SCHEME}://r/${encodeURIComponent(code)}`;

  const primary =
    platform === 'android'
      ? `<a class="primary" href="${escapeHtml(androidIntentUrl(code))}">Get i-Planner</a>`
      : platform === 'ios'
        ? `<a class="primary" href="${APP_STORE_URL}">Get i-Planner</a>`
        : `<a class="primary" href="${APP_STORE_URL}">Download on the App Store</a>
           <a class="primary" style="margin-top:10px" href="${escapeHtml(playStoreUrlWithCode(code))}">Get it on Google Play</a>`;

  const secondary =
    platform === 'other' ? '' : `<a class="secondary" href="${escapeHtml(openApp)}">Already have the app? Open i-Planner</a>`;

  const title = 'Join me on i-Planner';
  const description = `Use my referral code ${code} when you sign up and we both earn points.`;
  const image = `${env.shareBaseUrl}/email-logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta name="twitter:card" content="summary" />
    <style>${STYLES}</style>
  </head>
  <body>
    <div class="card">
      <img class="logo" src="/email-logo.png" alt="i-Planner" />
      <h1>You've been invited to i-Planner</h1>
      <p>Plan your tasks, goals and study time in one place. Sign up with this code and you both earn points.</p>
      <div class="code-label">REFERRAL CODE</div>
      <div class="code" id="code">${shown}</div>
      <button class="copy" id="copy" type="button">Copy code</button>
      ${primary}
      ${secondary}
      <div class="hint">After installing, enter the code when you create your account.</div>
    </div>
    <script>
      (function () {
        var button = document.getElementById('copy');
        button.addEventListener('click', function () {
          var text = ${JSON.stringify(code)};
          var done = function () { button.textContent = 'Copied'; };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
          else done();
        });
      })();
    </script>
  </body>
</html>`;
}

// For a link that is not a real code (mistyped, cut off when copied).
export function buildReferralNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>i-Planner</title>
    <style>${STYLES}</style>
  </head>
  <body>
    <div class="card">
      <img class="logo" src="/email-logo.png" alt="i-Planner" />
      <h1>That invitation link looks incomplete</h1>
      <p>Ask your friend to send it again. You can still get i-Planner below.</p>
      <a class="primary" href="${APP_STORE_URL}">Download on the App Store</a>
      <a class="primary" style="margin-top:10px" href="${PLAY_STORE_URL}">Get it on Google Play</a>
    </div>
  </body>
</html>`;
}
