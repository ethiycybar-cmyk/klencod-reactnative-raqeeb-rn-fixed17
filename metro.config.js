const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
  },
  transformer: {
    // تحميل الوحدات عند أول استخدام فقط => إقلاع أسرع.
    getTransformOptions: async () => ({
      transform: { experimentalImportSupport: false, inlineRequires: true },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
