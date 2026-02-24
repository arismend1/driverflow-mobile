import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();

    useEffect(() => {
        if (!token) return;
        loadTickets();
    }, [token]);

    const loadTickets = async () => {
        try {
            if (!token) return;
            setLoading(true);
            const data = await getTickets(token);
            setTickets(data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los tickets');
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

    if (loading) return <ActivityIndicator style={styles.center} size="large" />;

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Mis Tickets</Text>
            <FlatList
                data={tickets}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.empty}>Aún no tienes tickets.</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
    card: { backgroundColor: 'white', padding: 16, marginVertical: 8, borderRadius: 8, elevation: 2 },
    title: { fontWeight: 'bold', fontSize: 16 },
    status: { color: 'blue', fontWeight: 'bold', marginVertical: 4 },
    empty: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' }
});
