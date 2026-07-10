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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { loginUser, verifyOtp } from '../api';

type AuthStep = 'phone' | 'otp';

interface AuthScreensProps {
  onLoginSuccess: (userId: string, userName: string) => void;
}

const DriverAuthScreens: React.FC<AuthScreensProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<AuthStep>('phone');
  const [loading, setLoading] = useState(false);

  // Form State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
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
    const result = await loginUser(phone, 'transporter');
    setLoading(false);

    if (result.success) {
      if (result.isNewUser) {
        Alert.alert('Not Registered', 'This phone number is not registered. Please contact admin to create a driver account.');
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
    const result = await loginUser(phone, 'transporter');
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
    const result = await verifyOtp(phone, otp, 'transporter');
    setLoading(false);

    if (result.success) {
      if (result.user) {
        onLoginSuccess(result.user.id, result.user.name);
      } else {
        Alert.alert('Error', 'Login failed. Account not found.');
        setStep('phone');
      }
    } else {
      Alert.alert('Error', result.error || 'Invalid OTP');
    }
  };

  const renderPhone = () => (
    <View style={s.card}>
      <Text style={s.title}>Driver Login</Text>
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
          color: cooldown > 0 ? '#94A3B8' : '#10B981', 
          fontSize: 14, 
          fontWeight: '700', 
          textAlign: 'center'
        }}>
          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btn} onPress={handleOtpSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#020617" /> : <Text style={s.btnText}>Verify</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setStep('phone')} style={{ marginTop: 16 }}>
        <Text style={s.linkText}>Change Phone Number</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Dynamic Background Elements */}
      <View style={s.bgShape1} />
      <View style={s.bgShape2} />
      <View style={s.bgShape3} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={s.logoContainer}>
            <Text style={s.logoText}>GoZo</Text>
            <Text style={s.logoSub}>Driver Network</Text>
          </View>
          
          {step === 'phone' && renderPhone()}
          {step === 'otp' && renderOtp()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' }, // Ultra dark background
  scrollContainer: { flexGrow: 1, paddingBottom: 40, justifyContent: 'center' },
  
  bgShape1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: '#064E3B', opacity: 0.4 },
  bgShape2: { position: 'absolute', top: 250, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#047857', opacity: 0.2 },
  bgShape3: { position: 'absolute', bottom: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: '#059669', opacity: 0.15 },

  logoContainer: { alignItems: 'center', marginBottom: 50, zIndex: 10 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#F8FAFC', letterSpacing: -1.5 },
  logoSub: { fontSize: 13, color: '#10B981', marginTop: 4, textTransform: 'uppercase', letterSpacing: 4, fontWeight: '800' },
  
  card: { backgroundColor: '#0F172A', marginHorizontal: 24, borderRadius: 28, padding: 32, elevation: 12, shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, zIndex: 10, borderWidth: 1, borderColor: '#1E293B' },
  title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#334155' },
  prefix: { fontSize: 16, fontWeight: '700', color: '#94A3B8', marginRight: 12, borderRightWidth: 1.5, borderRightColor: '#334155', paddingRight: 12 },
  input: { flex: 1, height: 60, fontSize: 16, color: '#F8FAFC', fontWeight: '600' },
  
  btn: { backgroundColor: '#10B981', borderRadius: 16, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  btnText: { color: '#020617', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  linkText: { color: '#10B981', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});

export default DriverAuthScreens;
