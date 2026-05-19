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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { loginUser, verifyOtp, signupUser } from '../api';

type AuthStep = 'login' | 'otp' | 'signup';

interface AuthScreensProps {
  onLoginSuccess: (userId: string, userName: string) => void;
}

const DriverAuthScreens: React.FC<AuthScreensProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<AuthStep>('login');
  const [loading, setLoading] = useState(false);

  // Form State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');

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
    if (!name) {
      Alert.alert('Missing Info', 'Please enter your name.');
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
      role: 'transporter',
      fcmToken,
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
      <Text style={s.title}>GoZo Driver</Text>
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
    <View style={s.card}>
      <Text style={s.title}>Complete Profile</Text>
      <Text style={s.subtitle}>You are registering as a Driver</Text>
      
      <View style={s.field}>
        <Text style={s.label}>Full Name</Text>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.input}
            placeholder="e.g. Jaswinder Singh"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
        </View>
      </View>

      <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={handleSignupSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Start Driving</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.logoContainer}>
          <Text style={s.logoText}>GoZo</Text>
          <Text style={s.logoSub}>Driver App</Text>
        </View>
        
        {step === 'login' && renderLogin()}
        {step === 'otp' && renderOtp()}
        {step === 'signup' && renderSignup()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 42, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  logoSub: { fontSize: 14, color: '#16A34A', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700' },
  card: { backgroundColor: '#1F2937', marginHorizontal: 20, borderRadius: 24, padding: 24, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#F9FAFB', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#D1D5DB', marginBottom: 6, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#4B5563' },
  prefix: { fontSize: 16, fontWeight: '700', color: '#9CA3AF', marginRight: 8, borderRightWidth: 1, borderRightColor: '#4B5563', paddingRight: 8 },
  input: { flex: 1, height: 56, fontSize: 16, color: '#F9FAFB' },
  btn: { backgroundColor: '#16A34A', borderRadius: 14, height: 56, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  linkText: { color: '#16A34A', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

export default DriverAuthScreens;
