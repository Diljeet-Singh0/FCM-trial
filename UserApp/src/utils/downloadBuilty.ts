import { Alert, PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { API_BASE_URL } from '../config';

/**
 * Downloads the builty receipt image to the device's Downloads folder.
 * Uses react-native-blob-util for reliable native file downloads on Android.
 * Falls back to sharing on iOS.
 */
export const downloadBuilty = async (requestId: string): Promise<void> => {
  try {
    // Request storage permission on Android
    if (Platform.OS === 'android') {
      // Android 13+ (API 33+) doesn't need WRITE_EXTERNAL_STORAGE for Downloads
      const sdkInt = Platform.Version;
      if (typeof sdkInt === 'number' && sdkInt < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs storage access to download the builty receipt.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Cannot download without storage permission.');
          return;
        }
      }
    }

    const downloadUrl = `${API_BASE_URL}/gozo/download-builty/${requestId}`;
    const fileName = `builty_${requestId.slice(0, 7)}.jpg`;

    // Use Android's Downloads directory
    const downloadDir = Platform.OS === 'android'
      ? ReactNativeBlobUtil.fs.dirs.DownloadDir
      : ReactNativeBlobUtil.fs.dirs.DocumentDir;
    const filePath = `${downloadDir}/${fileName}`;

    Alert.alert('⬇️ Downloading...', 'Saving builty receipt to Downloads folder.');

    const res = await ReactNativeBlobUtil.config({
      path: filePath,
      fileCache: true,
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        title: `Builty Receipt - ${requestId.slice(0, 7)}`,
        description: 'Downloading builty receipt image',
        mime: 'image/jpeg',
        mediaScannable: true,
        path: filePath,
      },
    }).fetch('GET', downloadUrl);

    if (res.info().status === 200) {
      Alert.alert('✅ Downloaded!', `Builty receipt saved to Downloads as "${fileName}".`);
    } else {
      Alert.alert('❌ Download Failed', 'Could not download the builty receipt. Please try again.');
    }
  } catch (error: any) {
    console.error('[downloadBuilty] Error:', error);
    Alert.alert('❌ Download Error', error?.message || 'Something went wrong while downloading.');
  }
};

/**
 * Saves a base64 builty image directly to Downloads folder (no network request needed).
 * Use this when the base64 image is already available in state.
 */
export const saveBuiltyFromBase64 = async (requestId: string, base64Image: string): Promise<void> => {
  try {
    // Request storage permission on Android < 33
    if (Platform.OS === 'android') {
      const sdkInt = Platform.Version;
      if (typeof sdkInt === 'number' && sdkInt < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs storage access to save the builty receipt.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Cannot save without storage permission.');
          return;
        }
      }
    }

    const fileName = `builty_${requestId.slice(0, 7)}.jpg`;
    const downloadDir = Platform.OS === 'android'
      ? ReactNativeBlobUtil.fs.dirs.DownloadDir
      : ReactNativeBlobUtil.fs.dirs.DocumentDir;
    const filePath = `${downloadDir}/${fileName}`;

    // Strip the data URL prefix if present
    let cleanBase64 = base64Image;
    if (cleanBase64.startsWith('data:')) {
      const parts = cleanBase64.split(',');
      if (parts.length > 1) {
        cleanBase64 = parts[1];
      }
    }

    await ReactNativeBlobUtil.fs.writeFile(filePath, cleanBase64, 'base64');

    // Scan the file so it appears in the gallery / file manager
    if (Platform.OS === 'android') {
      try {
        await ReactNativeBlobUtil.fs.scanFile([{ path: filePath, mime: 'image/jpeg' }]);
      } catch (_scanErr) {
        // Non-critical — file is still saved
      }
    }

    Alert.alert('✅ Saved!', `Builty receipt saved to Downloads as "${fileName}".`);
  } catch (error: any) {
    console.error('[saveBuiltyFromBase64] Error:', error);
    Alert.alert('❌ Save Error', error?.message || 'Something went wrong while saving.');
  }
};
