// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // admin-web is its own project (React web, deployed to Vercel) with its own checks.
    ignores: ['dist/*', 'editor-web/build/*', 'admin-web/*', 'backend/dist/*'],
  },
]);
