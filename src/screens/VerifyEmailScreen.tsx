import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { verifyEmail, resendVerification, mapErrorToMessage } from '../api/client';

export default function VerifyEmailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    // Params from Register or Deep Link
    const { email, type, token: paramToken } = route.params || {};

    const [token, setToken] = useState(paramToken || '');
    const [loading, setLoading] = useState(false);

    // Auto-verify if token is present on mount
    const handleVerify = useCallback(async (tokenToVerify: string) => {
        if (!tokenToVerify) return;
        setLoading(true);
        const res = await verifyEmail(tokenToVerify);
        setLoading(false);

        if (res.ok) {
            Alert.alert('Verified!', 'Your email has been confirmed.', [
                { text: 'Go to Login', onPress: () => navigation.navigate('Login') }
            ]);
        } else {
            const msg = mapErrorToMessage(res.error);
            Alert.alert('Verification Error', msg);
        }
    }, [navigation]);

    // Auto-verify if token is present on mount
    useEffect(() => {
        if (paramToken) {
            handleVerify(paramToken);
        }
    }, [paramToken, handleVerify]);

    const handleResend = async () => {
        if (!email || !type) {
            Alert.alert('Error', 'We do not have your email or account type to resend.');
            return;
        }
        setLoading(true);
        const res = await resendVerification(type, email);
        setLoading(false);

        if (res.ok) {
            Alert.alert('Sent', 'If the account exists, you will receive a new email.');
        } else {
            Alert.alert('Error', mapErrorToMessage(res.error));
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Verify your Email</Text>
            <Text style={styles.subtitle}>
                We have sent a confirmation link to {email || 'your email'}.
            </Text>

            <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={loading}>
                <Text style={styles.resendText}>Resend Email</Text>
            </TouchableOpacity>

            <Text style={styles.orText}>- Or enter token manually -</Text>

            <TextInput
                style={styles.input}
                placeholder="Paste Verification Token"
                value={token}
                onChangeText={setToken}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#007BFF" />
            ) : (
                <TouchableOpacity style={styles.button} onPress={() => handleVerify(token)}>
                    <Text style={styles.buttonText}>VERIFY NOW</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    input: {
        width: '100%',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ced4da',
        padding: 15,
        marginBottom: 20,
        borderRadius: 8,
        fontSize: 16,
        textAlign: 'center',
    },
    button: {
        width: '100%',
        backgroundColor: '#28a745',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resendButton: {
        marginBottom: 30,
        padding: 10,
    },
    resendText: {
        color: '#007BFF',
        fontSize: 16,
        fontWeight: '600',
    },
    orText: {
        color: '#adb5bd',
        marginBottom: 15,
    },
    backButton: {
        marginTop: 20,
    },
    backText: {
        color: '#6c757d',
    },
});
