import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { request, mapErrorToMessage } from '../api/client';

export default function ResetPasswordScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (route.params?.token) {
            setToken(route.params.token);
        }
    }, [route.params]);

    const handleReset = async () => {
        if (!token) {
            Alert.alert('Invalid Link', 'The recovery link is invalid or missing a token.');
            return;
        }
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'All fields are required.');
            return;
        }
        if (newPassword.length < 8) {
            Alert.alert('Security', 'Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }

        setLoading(true);

        const res = await request('/reset_password', 'POST', {
            token,
            newPassword: newPassword,
        });

        if (res.ok) {
            Alert.alert('Success', 'Password updated. Please log in.', [
                { text: 'OK', onPress: () => navigation.navigate('Login') }
            ]);
        } else {
            const msg = mapErrorToMessage(res.error);
            Alert.alert('Error', msg);
        }
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your new password</Text>

            <View style={styles.form}>
                <TextInput
                    style={styles.input} // Ensure token is visible/editable just in case
                    placeholder="Token Code"
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                />
                <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                />

                {loading ? (
                    <ActivityIndicator size="large" color="#007BFF" />
                ) : (
                    <TouchableOpacity style={styles.button} onPress={handleReset}>
                        <Text style={styles.buttonText}>SET PASSWORD</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.backText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8f9fa' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
    subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
    form: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 3 },
    input: { backgroundColor: '#f1f3f5', padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16 },
    button: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    backButton: { marginTop: 15, alignItems: 'center' },
    backText: { color: '#666' }
});
