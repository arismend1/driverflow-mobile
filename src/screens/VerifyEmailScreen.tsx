import React, { useState, useEffect } from 'react';
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
    useEffect(() => {
        if (paramToken) {
            handleVerify(paramToken);
        }
    }, [paramToken]);

    const handleVerify = async (tokenToVerify: string) => {
        if (!tokenToVerify) return;
        setLoading(true);
        const res = await verifyEmail(tokenToVerify);
        setLoading(false);

        if (res.ok) {
            Alert.alert('¡Verificado!', 'Tu correo ha sido confirmado.', [
                { text: 'Ir a Login', onPress: () => navigation.replace('Login') }
            ]);
        } else {
            const msg = mapErrorToMessage(res.error);
            Alert.alert('Error de Verificación', msg);
        }
    };

    const handleResend = async () => {
        if (!email || !type) {
            Alert.alert('Error', 'No tenemos tu email o tipo de cuenta para reenviar.');
            return;
        }
        setLoading(true);
        const res = await resendVerification(type, email);
        setLoading(false);

        if (res.ok) {
            Alert.alert('Enviado', 'Si la cuenta existe, recibirás un nuevo correo.');
        } else {
            Alert.alert('Error', mapErrorToMessage(res.error));
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Verifica tu Correo</Text>
            <Text style={styles.subtitle}>
                Hemos enviado un enlace de confirmación a {email || 'tu correo'}.
            </Text>

            <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={loading}>
                <Text style={styles.resendText}>Reenviar Correo</Text>
            </TouchableOpacity>

            <Text style={styles.orText}>- O ingresa el token manual -</Text>

            <TextInput
                style={styles.input}
                placeholder="Pegar Token de Verificación"
                value={token}
                onChangeText={setToken}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#007BFF" />
            ) : (
                <TouchableOpacity style={styles.button} onPress={() => handleVerify(token)}>
                    <Text style={styles.buttonText}>VERIFICAR AHORA</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.replace('Login')}>
                <Text style={styles.backText}>Volver a Login</Text>
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
