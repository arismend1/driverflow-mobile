import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { createRequest, mapErrorToMessage } from '../api/client';

export default function CreateRequestScreen() {
    const navigation = useNavigation();
    const { token } = useAuth();
    
    const [licenciaReq, setLicenciaReq] = useState<'A' | 'B' | 'C'>('A');
    const [ubicacion, setUbicacion] = useState('');
    const [tiempoEstimado, setTiempoEstimado] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        // Validation
        if (!ubicacion.trim() || !tiempoEstimado.trim()) {
            Alert.alert('Error', 'All fields are required.');
            return;
        }

        const timeNum = parseInt(tiempoEstimado, 10);
        if (isNaN(timeNum) || timeNum <= 0) {
            Alert.alert('Error', 'Estimated time must be a number greater than 0.');
            return;
        }

        setLoading(true);
        try {
            const res = await createRequest(
                {
                    licencia_req: licenciaReq,
                    ubicacion: ubicacion.trim(),
                    tiempo_estimado: timeNum
                },
                token || ''
            );

            if (res.ok) {
                Alert.alert('Success', 'Request created successfully! Drivers will be notified.');
                // Clear form
                setUbicacion('');
                setTiempoEstimado('');
                navigation.goBack();
            } else {
                Alert.alert('Error', mapErrorToMessage(res.error));
            }
        } catch (e: any) {
            Alert.alert('Error', 'Connection error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={styles.header}>Post New Job</Text>
                <Text style={styles.subtitle}>Fill in the details to find matching drivers.</Text>

                <View style={styles.section}>
                    <Text style={styles.label}>License Required</Text>
                    <View style={styles.optionContainer}>
                        {(['A', 'B', 'C'] as const).map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.optionButton, licenciaReq === type && styles.optionSelected]}
                                onPress={() => setLicenciaReq(type)}
                            >
                                <Text style={[styles.optionText, licenciaReq === type && styles.optionTextSelected]}>Class {type}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Location (City, State)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Miami, FL"
                        value={ubicacion}
                        onChangeText={setUbicacion}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Estimated Time (Minutes)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 120"
                        keyboardType="numeric"
                        value={tiempoEstimado}
                        onChangeText={setTiempoEstimado}
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
                    onPress={handleCreate}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.submitButtonText}>Create Request</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 24,
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6c757d',
        marginBottom: 32,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 12,
    },
    optionContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    optionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dee2e6',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    optionSelected: {
        backgroundColor: '#007BFF',
        borderColor: '#007BFF',
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
    },
    optionTextSelected: {
        color: '#fff',
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1a1a1a',
    },
    submitButton: {
        backgroundColor: '#007BFF',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
