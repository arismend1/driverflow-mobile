import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { getTickets } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Ticket {
    id: number;
    billing_status: string;
    price_cents: number;
    currency: string;
    created_at: string;
    company_name: string;
}

export const DriverTicketsScreen = () => {
    const { token } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadTickets();
    }, [token]);

    const loadTickets = async () => {
        if (!token) {
            setError('No hay sesión activa.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await getTickets(token);
            setTickets(data || []);
        } catch (err: any) {
            console.error("[TICKETS] Load failed", err);
            setError(`Error cargando tickets: ${err.message || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: Ticket }) => (
        <View style={styles.card}>
            <Text style={styles.title}>Ticket #{item.id}</Text>
            <Text>Empresa: {item.company_name}</Text>
            <Text style={styles.status}>Estado: {item.billing_status.toUpperCase()}</Text>
            <Text>Fecha: {new Date(item.created_at).toLocaleDateString()}</Text>
            <Text>Monto: {(item.price_cents / 100).toFixed(2)} {item.currency}</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007BFF" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadTickets}>
                    <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Mis Tickets</Text>
            <FlatList
                data={tickets}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.empty}>Aún no tienes tickets.</Text>}
                onRefresh={loadTickets}
                refreshing={loading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333' },
    card: { backgroundColor: 'white', padding: 16, marginVertical: 8, borderRadius: 8, elevation: 2 },
    title: { fontWeight: 'bold', fontSize: 16 },
    status: { color: '#007BFF', fontWeight: 'bold', marginVertical: 4 },
    empty: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
    errorText: { color: '#dc3545', fontSize: 16, marginBottom: 20, textAlign: 'center' },
    retryButton: { backgroundColor: '#007BFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: 'white', fontWeight: 'bold' }
});
