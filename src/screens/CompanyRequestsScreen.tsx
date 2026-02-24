import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
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

            <Text style={styles.label}>Licencia Requerida: {licencia}</Text>
            <View style={styles.row}>
                <Button title="A" onPress={() => setLicencia('A')} color={licencia === 'A' ? 'blue' : 'gray'} />
                <View style={{ width: 10 }} />
                <Button title="B" onPress={() => setLicencia('B')} color={licencia === 'B' ? 'blue' : 'gray'} />
            </View>

            <View style={{ marginTop: 20 }}>
                {loading ? <ActivityIndicator /> : <Button title="Publicar Solicitud" onPress={handleCreate} />}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    label: { fontSize: 16, marginBottom: 5, marginTop: 15 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
    row: { flexDirection: 'row', marginTop: 10 }
});
