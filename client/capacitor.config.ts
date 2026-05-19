import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the React build into an Android (and optionally iOS) shell so it can
// be installed as an APK on field-team phones. The web bundle lives in
// `build/` (produced by `npm run build`) and is bundled into the native app.
//
// For a remote-loaded experience (mobile shell points at your deployed Vercel
// URL), uncomment the `server.url` line below.
const config: CapacitorConfig = {
  appId: 'in.aromadelite.app',
  appName: 'Aromadelite',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // url: 'https://aromadelite.vercel.app',
    // cleartext: true,
  },
};

export default config;
