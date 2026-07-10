// BuiltyCameraScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Camera, CameraRef, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

interface Props {
  onCapture: (base64Img: string) => void;
  onCancel: () => void;
}

const BuiltyCameraScreen: React.FC<Props> = ({ onCapture, onCancel }) => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isLoading, setIsLoading] = useState(false);
  const cameraRef = React.useRef<CameraRef>(null);
  const photoOutput = usePhotoOutput();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const takePhoto = useCallback(async () => {
    if (!device) return;
    setIsLoading(true);
    try {
      const photo = await photoOutput.capturePhotoToFile({
        flashMode: 'off',
        enableShutterSound: false,
      }, {});
      
      // Convert to base64 using filePath
      const base64 = await fetch(`file://${photo.filePath}`).then(r => r.blob()).then(blob => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
      const cleanBase64 = base64.split(',')[1];
      onCapture(cleanBase64);
    } catch (e) {
      Alert.alert('Camera Error', 'Failed to capture image');
    } finally {
      setIsLoading(false);
    }
  }, [device, photoOutput, onCapture]);

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Camera permission denied.</Text>
        <TouchableOpacity onPress={onCancel} style={styles.button}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera 
        ref={cameraRef} 
        style={StyleSheet.absoluteFill} 
        device={device} 
        isActive={true} 
        outputs={[photoOutput]}
      />
      <View style={styles.controls}>
        <TouchableOpacity onPress={onCancel} style={styles.controlButton}>
          <Text style={styles.controlText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={takePhoto} style={styles.controlButton} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.controlText}>Capture</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  controlButton: { padding: 12, backgroundColor: '#1A56DB', borderRadius: 8 },
  controlText: { color: '#FFF', fontWeight: '600' },
  button: { marginTop: 20, padding: 10, backgroundColor: '#1A56DB', borderRadius: 6 },
  buttonText: { color: '#FFF' },
});

export default BuiltyCameraScreen;

