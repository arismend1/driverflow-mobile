import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';

export default function MatchesScreen() {
    const { token, userInfo: user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [matches, setMatches] = useState<any[]>([]);

    useEffect(() => {
        loadMatches();
    }, []);

    const loadMatches = async () => {
        try {
            const endpoint = user?.type === 'empresa' ? '/matches/candidates' : '/matches/opportunities';
            const res = await fetch(`${API_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMatches(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = (item: any) => {
        // Implementation for Accept Flow (Ticket Creation) would go here
        Alert.alert('Match', `Has seleccionado a ${item.display_name}. La funcionalidad de Ticket + Pago se inicia aquí en próximas fases.`);
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>{item.display_name}</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.match_score}%</Text></View>
            </View>

            {user?.type === 'empresa' ? (
                <>
                    <Text style={styles.detail}>Experiencia: {item.experience_years} años</Text>
                    <Text style={styles.detail}>Licencias: {item.license_summ}</Text>
                </>
            ) : (
                <>
                    {/* UX Requirements: Op Type, Avail, Pay */}
                    <Text style={styles.detail}>Operation: {item.op_types}</Text>
                    <Text style={styles.detail}>Pay: {item.pay_methods}</Text>
                    <Text style={styles.detail}>Availability: {item.availability}</Text>
                </>
            )}

            <TouchableOpacity style={styles.button} onPress={() => handleAccept(item)}>
                <Text style={styles.buttonText}>View Details / Accept</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>Match Results</Text>
            {matches.length === 0 ? (
                <View style={styles.empty}>
                    {user?.type === 'driver' ? (
                        <>
                            <Text style={styles.emptyTitle}>Your profile is active and visible ✅</Text>
                            <Text style={styles.emptyText}>There are no offers matching 100% with your requirements today. We will let you know as soon as a company searches for your exact profile.</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.emptyTitle}>Searching for qualified professionals...</Text>
                            <Text style={styles.emptyText}>We couldn't find drivers with these exact requirements. Try flexing the experience or endorsements if you need quick results.</Text>
                        </>
                    )}
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item, idx) => idx.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
    pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 18, fontWeight: 'bold' },
    badge: { backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    detail: { fontSize: 14, color: '#666', marginBottom: 5 },
    button: { backgroundColor: '#000', padding: 10, borderRadius: 5, alignItems: 'center', marginTop: 10 },
    buttonText: { color: '#fff', fontWeight: 'bold' },
    empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
    emptyText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 }
});
