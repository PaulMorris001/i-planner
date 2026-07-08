const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      require.resolve('babel-preset-expo', {
        paths: [path.join(__dirname, 'node_modules', 'expo')],
      }),
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
        },
      ],
      // Must be listed last — react-native-reanimated/worklets requirement.
      'react-native-worklets/plugin',
    ],
  };
};
