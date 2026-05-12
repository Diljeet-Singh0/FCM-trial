import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage.data?.type === 'NEW_REQUEST') {
    await notifee.createChannel({
      id: 'requests',
      name: 'Shipment Requests',
      importance: AndroidImportance.HIGH,
    });
    await notifee.displayNotification({
      title: remoteMessage.notification?.title ?? '🚛 New Shipment Request',
      body: remoteMessage.notification?.body ?? 'A new shipment needs transport',
      android: {
        channelId: 'requests',
        pressAction: { id: 'default' },
      },
    });
  }
});

AppRegistry.registerComponent(appName, () => App);

