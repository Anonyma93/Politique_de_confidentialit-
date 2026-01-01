import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';

import App from './App';

// Gestionnaire de messages en arrière-plan pour Firebase Cloud Messaging
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📬 Message reçu en arrière-plan!', remoteMessage);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
