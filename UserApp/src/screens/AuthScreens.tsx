import React, { useState, useEffect } from 'react';
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

type AuthStep = 'phone' | 'otp' | 'signup';

interface AuthScreensProps {
  onLoginSuccess: (userId: string, userName: string) => void;
}

const AuthScreens: React.FC<AuthScreensProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<AuthStep>('phone');
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
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    const result = await loginUser(phone, 'owner');
    setLoading(false);

    if (result.success) {
      if (authMode === 'login' && result.isNewUser) {
        Alert.alert('Not Registered', 'This phone number is not registered. Please create an account.');
        return;
      }
      if (authMode === 'signup' && !result.isNewUser) {
        Alert.alert('Already Registered', 'This phone number is already registered. Please log in instead.');
        return;
      }
      setStep('otp');
      setCooldown(30);
    } else {
      Alert.alert('Error', result.error || 'Failed to request OTP');
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    const result = await loginUser(phone, 'owner');
    setLoading(false);

    if (result.success) {
      Alert.alert('OTP Sent', 'A new verification code has been sent to your phone number.');
      setCooldown(30);
    } else {
      Alert.alert('Error', result.error || 'Failed to resend OTP');
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    const result = await verifyOtp(phone, otp, 'owner');
    setLoading(false);

    if (result.success) {
      if (authMode === 'login' && result.user) {
        onLoginSuccess(result.user.id, result.user.name);
      } else if (authMode === 'signup' && !result.user) {
        setStep('signup');
      } else {
        Alert.alert('Error', 'Authentication flow mismatch. Please try again.');
        setStep('phone');
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

  const renderPhone = () => (
    <View style={s.card}>
      <Text style={s.title}>{authMode === 'login' ? 'Login to GoZo' : 'Create Account'}</Text>
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

      <TouchableOpacity style={s.btn} onPress={handlePhoneSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Send OTP</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={() => {
          setAuthMode(authMode === 'login' ? 'signup' : 'login');
          setPhone('');
        }} 
        style={{ marginTop: 20 }}
      >
        <Text style={s.linkText}>
          {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtp = () => (
    <View style={s.card}>
      <Text style={s.title}>Verify Phone</Text>
      <Text style={s.subtitle}>Enter the OTP sent to {phone}</Text>
      
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

      <TouchableOpacity 
        onPress={handleResendOtp} 
        disabled={cooldown > 0 || loading} 
        style={{ marginTop: 12, marginBottom: 12 }}
      >
        <Text style={{
          color: cooldown > 0 ? '#9CA3AF' : '#10B981', 
          fontSize: 14, 
          fontWeight: '700', 
          textAlign: 'center'
        }}>
          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btn} onPress={handleOtpSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Verify</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setStep('phone')} style={{ marginTop: 16 }}>
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
      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={s.logoContainer}>
          <Text style={s.logoText}>Go<Text style={{ color: '#10B981' }}>Zo</Text></Text>
          <Text style={s.logoSub}>Enterprise Logistics</Text>
        </View>
        
        {step === 'phone' && renderPhone()}
        {step === 'otp' && renderOtp()}
        {step === 'signup' && renderSignup()}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContainer: { flexGrow: 1, paddingBottom: 40, justifyContent: 'center' },

  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logoText: { fontSize: 48, fontWeight: '900', color: '#1A1A1A', letterSpacing: -1 },
  logoSub: { fontSize: 11, color: '#6B6B6B', marginTop: 4, textTransform: 'uppercase', letterSpacing: 3, fontWeight: '700' },
  
  card: { backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 12, padding: 24, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#F2F2F2' },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B6B6B', marginBottom: 6, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  prefix: { fontSize: 16, fontWeight: '700', color: '#6B6B6B', marginRight: 12, borderRightWidth: 1, borderRightColor: '#E2E8F0', paddingRight: 12 },
  input: { flex: 1, height: 50, fontSize: 16, color: '#1A1A1A', fontWeight: '500' },
  
  btn: { backgroundColor: '#10B981', borderRadius: 28, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  linkText: { color: '#10B981', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  
  locationBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, minHeight: 50, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  locationBtnText: { color: '#6B6B6B', fontSize: 14, fontWeight: '500' },
});

export default AuthScreens;

