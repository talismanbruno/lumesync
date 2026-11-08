exports.default = async function beforePack(context) {
  if (context.electronPlatformName !== 'win32') return;
  if (process.platform !== 'win32') throw new Error('Windows audio helper must be built on a Windows runner');
  require('./build-native.cjs');
};
