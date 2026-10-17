import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.robbdevo.voidreigen',
  appName: 'Void Reigen',
  webDir: 'dist',
  backgroundColor: '#0a0520',
  android: { backgroundColor: '#0a0520', allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 900, launchAutoHide: true, backgroundColor: '#0a0520', showSpinner: false, androidScaleType: 'CENTER_CROP', launchFadeOutDuration: 300 },
  },
};
export default config;
