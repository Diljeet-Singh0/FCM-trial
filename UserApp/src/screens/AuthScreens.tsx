import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { loginUser, verifyOtp, signupUser } from '../api';
import MapLocationPicker from '../components/MapLocationPicker';

type AuthStep = 'login' | 'otp' | 'signup';

interface AuthScreensProps {
  onLoginSuccess: (userId: string, userName: string) => void;
}

const AuthScreens: React.FC<AuthScreensProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<AuthStep>('login');
  const [loading, setLoading] = useState(false);

  // Form State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [factoryAddress, setFactoryAddress] = useState('');
  const [factoryLat, setFactoryLat] = useState<number | null>(null);
  const [factoryLng, setFactoryLng] = useState<number | null>(null);

  const [showMapPicker, setShowMapPicker] = useState(false);

  const handleLoginSubmit = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    const result = await loginUser(phone);
    setLoading(false);

    if (result.success) {
      setStep('otp');
    } else {
      Alert.alert('Error', result.error || 'Failed to request OTP');
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    const result = await verifyOtp(phone, otp);
    setLoading(false);

    if (result.success) {
      if (result.user) {
        // User exists, log them in
        onLoginSuccess(result.user.id, result.user.name);
      } else {
        // New user, go to signup
        setStep('signup');
      }
    } else {
      Alert.alert('Error', result.error || 'Invalid OTP');
    }
  };

  const handleSignupSubmit = async () => {
    if (!name || !factoryName || !factoryAddress) {
      Alert.alert('Missing Info', 'Please fill all fields.');
      return;
    }

    setLoading(true);
    let fcmToken = '';
    try {
      await messaging().requestPermission();
      fcmToken = await messaging().getToken();
    } catch (e) {
      console.log('FCM token fetch failed', e);
    }

    const result = await signupUser({
      phone,
      name,
      role: 'owner',
      fcmToken,
      factory_name: factoryName,
      factory_address: factoryAddress,
      factory_lat: factoryLat || undefined,
      factory_lng: factoryLng || undefined,
    });
    setLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user.id, result.user.name);
    } else {
      Alert.alert('Error', result.error || 'Signup failed');
    }
  };

  const renderLogin = () => (
    <View style={s.card}>
      <Text style={s.title}>Welcome to GoZo</Text>
      <Text style={s.subtitle}>Enter your phone number to continue</Text>
      
      <View style={s.inputWrapper}>
        <Text style={s.prefix}>+91</Text>
        <TextInput
          style={s.input}
          placeholder="Phone Number"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
      </View>

      <TouchableOpacity style={s.btn} onPress={handleLoginSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Send OTP</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderOtp = () => (
    <View style={s.card}>
      <Text style={s.title}>Verify Phone</Text>
      <Text style={s.subtitle}>Enter the OTP sent to {phone}</Text>
      <Text style={{color: '#16A34A', fontSize: 12, marginBottom: 12, textAlign: 'center'}}>Hint: Use 123456</Text>
      
      <View style={s.inputWrapper}>
        <TextInput
          style={[s.input, { textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
          placeholder="------"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
          maxLength={6}
        />
      </View>

      <TouchableOpacity style={s.btn} onPress={handleOtpSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Verify</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setStep('login')} style={{ marginTop: 16 }}>
        <Text style={s.linkText}>Change Phone Number</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSignup = () => (
    <ScrollView contentContainerStyle={s.card} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Complete Profile</Text>
      <Text style={s.subtitle}>You are registering as a Factory Owner</Text>
      
      <View style={s.field}>
        <Text style={s.label}>Your Name</Text>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.input}
            placeholder="John Doe"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Factory Name</Text>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.input}
            placeholder="GoZo Manufacturing Ltd."
            placeholderTextColor="#9CA3AF"
            value={factoryName}
            onChangeText={setFactoryName}
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Factory Location</Text>
        <TouchableOpacity style={s.locationBtn} onPress={() => setShowMapPicker(true)}>
          <Text style={s.locationBtnText} numberOfLines={2}>
            {factoryAddress ? factoryAddress : 'Tap to pin location on map 📍'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={handleSignupSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => {
          setFactoryAddress(loc.address);
          setFactoryLat(loc.latitude);
          setFactoryLng(loc.longitude);
          setShowMapPicker(false);
        }}
      />
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.logoContainer}>
        <Text style={s.logoText}>GoZo</Text>
        <Text style={s.logoSub}>Enterprise Logistics</Text>
      </View>
      
      {step === 'login' && renderLogin()}
      {step === 'otp' && renderOtp()}
      {step === 'signup' && renderSignup()}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A56DB' },
  logoContainer: { alignItems: 'center', marginTop: 60, marginBottom: 40 },
  logoText: { fontSize: 42, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  logoSub: { fontSize: 14, color: '#DBEAFE', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 },
  card: { backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: 24, padding: 24, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  prefix: { fontSize: 16, fontWeight: '700', color: '#4B5563', marginRight: 8, borderRightWidth: 1, borderRightColor: '#D1D5DB', paddingRight: 8 },
  input: { flex: 1, height: 56, fontSize: 16, color: '#111827' },
  btn: { backgroundColor: '#1A56DB', borderRadius: 14, height: 56, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  linkText: { color: '#1A56DB', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  locationBtn: { backgroundColor: '#F3F4F6', borderRadius: 14, minHeight: 56, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  locationBtnText: { color: '#111827', fontSize: 15 },
});

export default AuthScreens;
