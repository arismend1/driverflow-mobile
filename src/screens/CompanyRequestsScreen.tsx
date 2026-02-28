import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { createRequest, mapErrorToMessage } from '../api/client';

export const CompanyRequestsScreen = () => {
    const [licencia, setLicencia] = useState('B');
    const [ubicacion, setUbicacion] = useState('');
    const [tiempo, setTiempo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!ubicacion || !tiempo) {
            Alert.alert('Error', 'Completa todos los campos');
            return;
        }

        setLoading(true);
        const res = await createRequest({
            licencia_req: licencia,
            ubicacion,
            tiempo_estimado: parseInt(tiempo) || 60
        });
        setLoading(false);

        if (res.ok) {
            Alert.alert('Éxito', 'Solicitud creada correctamente');
            setUbicacion('');
            setTiempo('');
        } else {
            Alert.alert('Error', mapErrorToMessage(res.error));
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Crear Solicitud de Chofer</Text>

            <Text style={styles.label}>Ubicación</Text>
            <TextInput
                style={styles.input}
                value={ubicacion}
                onChangeText={setUbicacion}
                placeholder="Ej. Centro, Av. Principal"
            />

            <Text style={styles.label}>Tiempo Estimado (min)</Text>
            <TextInput
                style={styles.input}
                value={tiempo}
                onChangeText={setTiempo}
                placeholder="60"
                keyboardType="numeric"
            />

            <Text style={styles.label}>Licencia Requerida</Text>
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.licenseBtn, licencia === 'A' && styles.licenseBtnActive]}
                    onPress={() => setLicencia('A')}
                >
                    <Text style={[styles.licenseText, licencia === 'A' && styles.licenseTextActive]}>Clase A</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.licenseBtn, licencia === 'B' && styles.licenseBtnActive]}
                    onPress={() => setLicencia('B')}
                >
                    <Text style={[styles.licenseText, licencia === 'B' && styles.licenseTextActive]}>Clase B</Text>
                </TouchableOpacity>
            </View>

            <View style={{ marginTop: 30 }}>
                {loading ? <ActivityIndicator size="large" /> : <Button title="Crear Solicitud de Viaje" onPress={handleCreate} />}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    label: { fontSize: 16, marginBottom: 5, marginTop: 15 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
    row: { flexDirection: 'row', marginTop: 10, gap: 10 },
    licenseBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#007bff',
        borderRadius: 8,
        backgroundColor: 'transparent'
    },
    licenseBtnActive: {
        backgroundColor: '#007bff',
    },
    licenseText: {
        color: '#007bff',
        fontWeight: 'bold',
        fontSize: 16
    },
    licenseTextActive: {
        color: '#fff',
    }
});
