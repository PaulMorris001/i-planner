// Custom entry point (package.json "main") — required so this polyfill runs
// before ANY other module, including expo-router/entry.
//
// It used to live as the first import in app/_layout.tsx, but that's not
// early enough: expo-router builds its route table by eagerly require()-ing
// every file under app/ in alphabetical order (see getRoutesCore.js), and
// "(app)"/"(onboarding)" sort before "_layout.tsx" ('(' < '_' in ASCII). So
// app/(onboarding)/login.tsx — which pulls in crypto-js via AuthContext ->
// config/firebase.ts -> config/secureAuthStorage.ts — was already being
// required before app/_layout.tsx's first line ever ran. crypto-js captures
// its `crypto` reference into a closure variable exactly once, the moment
// it's first required, so a polyfill applied after that point never takes
// effect for the rest of the process. Only the true bundle entry point runs
// before expo-router's context requiring, so the polyfill has to live here.
import './polyfills/webCrypto';

import 'expo-router/entry';
