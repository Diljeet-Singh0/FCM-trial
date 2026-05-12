import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage.data?.type === 'REQUEST_ACCEPTED') {
    await notifee.createChannel({
      id: 'shipment_updates',
      name: 'Shipment Updates',
      importance: AndroidImportance.HIGH,
    });
    await notifee.displayNotification({
      title: remoteMessage.notification?.title ?? '✅ Shipment Accepted!',
      body: remoteMessage.notification?.body ?? 'A driver accepted your shipment',
      android: { channelId: 'shipment_updates', pressAction: { id: 'default' } },
    });
  }

  if (remoteMessage.data?.type === 'TRIP_STATUS_UPDATE') {
    await notifee.createChannel({
      id: 'shipment_updates',
      name: 'Shipment Updates',
      importance: AndroidImportance.HIGH,
    });
    await notifee.displayNotification({
      title: remoteMessage.notification?.title ?? '🚛 Trip Update',
      body: remoteMessage.notification?.body ?? 'Your shipment status has changed',
      android: { channelId: 'shipment_updates', pressAction: { id: 'default' } },
    });
  }
});

AppRegistry.registerComponent(appName, () => App);

