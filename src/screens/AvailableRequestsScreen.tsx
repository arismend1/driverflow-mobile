import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { getAvailableRequests, applyToRequest, mapErrorToMessage } from '../api/client';

interface RequestItem {
    id: number;
    licencia_req: string;
    ubicacion: string;
    company_name: string;
    tiempo_estimado: number;
}

export const AvailableRequestsScreen = () => {
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadParams = async () => {
        setLoading(true);
        try {
            const data = await getAvailableRequests();
            setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadParams();
    }, []);

    const handleApply = async (id: number) => {
        const res = await applyToRequest(id);
        if (res.ok) {
            Alert.alert('Aplicado', 'Has aplicado exitosamente. Espera confirmación.');
            loadParams(); // Refresh
        } else {
            Alert.alert('Error', mapErrorToMessage(res.error));
        }
    };

    const renderItem = ({ item }: { item: RequestItem }) => (
        <View style={styles.card}>
            <Text style={styles.title}>{item.company_name}</Text>
            <Text>Ubicación: {item.ubicacion}</Text>
            <Text>Tiempo: {item.tiempo_estimado} min</Text>
            <Text style={{ marginTop: 5, fontWeight: 'bold' }}>Licencia: {item.licencia_req}</Text>
            <View style={{ marginTop: 10 }}>
                <Button title="Aceptar Solicitud" onPress={() => handleApply(item.id)} />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Solicitudes Disponibles</Text>
            {loading ? <ActivityIndicator /> : (
                <FlatList
                    data={requests}
                    keyExtractor={i => i.id.toString()}
                    renderItem={renderItem}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No hay solicitudes para tu perfil.</Text>}
                />
            )}
            <Button title="Actualizar" onPress={loadParams} color="gray" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
    card: { backgroundColor: 'white', padding: 16, marginVertical: 8, borderRadius: 8, elevation: 2 },
    title: { fontWeight: 'bold', fontSize: 18, marginBottom: 5 }
});
