import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { getAvailableRequests, applyToRequest, mapErrorToMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface RequestItem {
    id: number;
    licencia_req: string;
    ubicacion: string;
    company_name: string;
    tiempo_estimado: number;
}

export const AvailableRequestsScreen = () => {
    const { token } = useAuth();
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadParams = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAvailableRequests(token || '');
            setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadParams();
    }, [loadParams]);

    const handleApply = async (id: number) => {
        const res = await applyToRequest(id, token || '');
        if (res.ok) {
            Alert.alert('Applied', 'You have successfully applied. Wait for confirmation.');
            loadParams(); // Refresh
        } else {
            Alert.alert('Error', mapErrorToMessage(res.error));
        }
    };

    const renderItem = ({ item }: { item: RequestItem }) => (
        <View style={styles.card}>
            <Text style={styles.title}>{item.company_name}</Text>
            <Text>Location: {item.ubicacion}</Text>
            <Text>Time: {item.tiempo_estimado} min</Text>
            <Text style={styles.licenseText}>License: {item.licencia_req}</Text>
            <View style={styles.applyButtonWrap}>
                <Button title="Accept Request" onPress={() => handleApply(item.id)} />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Available Requests</Text>
            {loading ? <ActivityIndicator /> : (
                <FlatList
                    data={requests}
                    keyExtractor={i => i.id.toString()}
                    renderItem={renderItem}
                    ListEmptyComponent={<Text style={styles.emptyText}>No requests available for your profile.</Text>}
                />
            )}
            <Button title="Refresh" onPress={loadParams} color="gray" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
    card: { backgroundColor: 'white', padding: 16, marginVertical: 8, borderRadius: 8, elevation: 2 },
    title: { fontWeight: 'bold', fontSize: 18, marginBottom: 5 },
    licenseText: { marginTop: 5, fontWeight: 'bold' },
    applyButtonWrap: { marginTop: 10 },
    emptyText: { textAlign: 'center', marginTop: 20 }
});
