import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { recoverPassword } from '../api/client';

export default function ForgotPasswordScreen() {
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRecover = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            await recoverPassword(email);
            Alert.alert(
                'Solicitud Enviada',
                'Si el correo está registrado, recibirás instrucciones y una contraseña temporal en breve.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send recovery email');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Recuperar Contraseña</Text>
                <Text style={styles.subtitle}>Ingresa tu correo para recibir una contraseña temporal.</Text>
            </View>

            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="Tu Correo Electrónico"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                {loading ? (
                    <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
                ) : (
                    <TouchableOpacity style={styles.button} onPress={handleRecover}>
                        <Text style={styles.buttonText}>ENVIAR</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>Volver al Login</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    form: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    input: {
        backgroundColor: '#f1f3f5',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        fontSize: 16,
        color: '#333',
    },
    button: {
        backgroundColor: '#007BFF',
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
    backButton: {
        alignItems: 'center',
        padding: 10,
    },
    backText: {
        color: '#6c757d',
        fontSize: 14,
    }
});
