import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { resendVerification } from '../api/client';

export default function LoginScreen() {
    const navigation = useNavigation<any>();
    const { login: authLogin } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState<'driver' | 'empresa'>('driver');
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            await authLogin(email.trim(), password, userType, remember);
            // Si remember es false, el RootNavigator nos llevará a Home automáticamente.
            // Si remember es true, el AuthContext seteará pinGate y el RootNavigator nos llevará a PinScreen.
        } catch (error: any) {
            Alert.alert('Login Failed', error?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email to resend confirmation');
            return;
        }

        setLoading(true);
        try {
            const res = await resendVerification(userType, email.trim());
            if (!res.ok) {
                throw new Error(res.error || 'Failed to resend verification');
            }
            Alert.alert('Success', 'We sent you a new confirmation email');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to resend confirmation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <Text style={styles.title}>DriverFlow</Text>
                <Text style={styles.subtitle}>Welcome back!</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, userType === 'driver' && styles.activeTab]}
                        onPress={() => setUserType('driver')}
                    >
                        <Text style={[styles.tabText, userType === 'driver' && styles.activeTabText]}>Driver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, userType === 'empresa' && styles.activeTab]}
                        onPress={() => setUserType('empresa')}
                    >
                        <Text style={[styles.tabText, userType === 'empresa' && styles.activeTabText]}>Company</Text>
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.input}
                    placeholder="Email / Phone"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor="#aaa"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                        <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.optionsRow}>
                    <TouchableOpacity style={styles.checkboxContainer} onPress={() => setRemember(!remember)}>
                        <View style={[styles.checkbox, remember && styles.checkboxActive]} />
                        <Text style={styles.rememberText}>Remember me</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                        <Text style={styles.forgotText}>Forgot your password?</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#007BFF" style={styles.loadingIndicator} />
                ) : (
                    <View>
                        <TouchableOpacity style={styles.button} onPress={handleLogin}>
                            <Text style={styles.buttonText}>LOGIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.resendButton} onPress={handleResend}>
                            <Text style={styles.resendText}>Resend confirmation email</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.registerContainer}>
                    <Text style={styles.text}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.linkText}>Register</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8f9fa' },
    header: { alignItems: 'center', marginBottom: 40 },
    title: { fontSize: 36, fontWeight: 'bold', color: '#007BFF', marginBottom: 10 },
    subtitle: { fontSize: 18, color: '#6c757d' },
    tabContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#f1f3f5', borderRadius: 8, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
    activeTab: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    tabText: { fontSize: 16, color: '#6c757d', fontWeight: '500' },
    activeTabText: { color: '#007BFF', fontWeight: 'bold' },
    optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center' },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#ccc', marginRight: 8 },
    checkboxActive: { backgroundColor: '#007BFF', borderColor: '#007BFF' },
    rememberText: { color: '#6c757d', fontSize: 14 },
    forgotText: { color: '#007BFF', fontWeight: '500', fontSize: 14 },
    form: { backgroundColor: '#fff', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    input: { backgroundColor: '#f1f3f5', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 16, color: '#333' },
    passwordContainer: { flexDirection: 'row', backgroundColor: '#f1f3f5', borderRadius: 8, marginBottom: 15, alignItems: 'center' },
    passwordInput: { flex: 1, padding: 15, fontSize: 16, color: '#333' },
    eyeButton: { padding: 15 },
    eyeText: { fontSize: 18 },
    loadingIndicator: { marginTop: 20 },
    button: { backgroundColor: '#007BFF', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, shadowColor: '#007BFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
    registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    text: { color: '#6c757d' },
    linkText: { color: '#007BFF', fontWeight: 'bold' },
    resendButton: { alignItems: 'center', marginTop: 15 },
    resendText: { color: '#007BFF', fontWeight: '500', fontSize: 14 },
});
