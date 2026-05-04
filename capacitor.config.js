import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cqlab.app',
  appName: 'CQLab',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    minVersion: '13.0'
  },
  android: {
    minVersion: '21'   // Android 5.0+
  }
};

export default config;
