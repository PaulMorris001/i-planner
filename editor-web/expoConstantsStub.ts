// TenTap's web code runs `try { require('expo-constants') } catch {}` to detect
// whether it is inside an Expo app, expecting that to throw in a plain browser
// page. Vite 8's bundler resolves that require() at build time and would pull
// the whole React Native runtime into the editor page. The vite config aliases
// 'expo-constants' to this file instead, which throws the way a missing module
// does, so the check still reports "not Expo".
throw new Error('expo-constants is not available inside the editor page');
