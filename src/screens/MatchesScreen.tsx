import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';

export default function MatchesScreen() {
    const { token, userInfo: user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [matches, setMatches] = useState<any[]>([]);

    // Depend on token + user.type so we retry once async bootstrap finishes
    useEffect(() => {
        loadMatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user?.type]);

    const loadMatches = async () => {
        setLoading(true);
        try {
            // Fallback: read directly from AsyncStorage if context token is still null
            const activeToken = token ?? await AsyncStorage.getItem('auth_token');
            const endpoint = user?.type === 'empresa' ? '/matches/candidates' : '/matches/opportunities';
            const url = `${API_URL}${endpoint}`;

            console.log(`[Matches] url=${url}`);
            console.log(`[Matches] context token: ${token ? 'EXISTS len=' + token.length : 'NULL'}`);
            console.log(`[Matches] activeToken: ${activeToken ? 'EXISTS len=' + activeToken.length : 'NULL'}`);
            console.log(`[Matches] user.type=${user?.type} user.id=${(user as any)?.id}`);

            if (!activeToken) {
                console.warn('[Matches] No token available — aborting fetch');
                setLoading(false);
                return;
            }

            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${activeToken}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log(`[Matches] status=${res.status} ok=${res.ok}`);

            if (res.ok) {
                const data = await res.json();
                console.log(`[Matches] received ${data.length} matches`);
                setMatches(data);
            } else {
                const errBody = await res.text();
                console.error(`[Matches] error response: ${errBody}`);
            }
        } catch (e) {
            console.error('[Matches] fetch exception:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = (item: any) => {
        const scoreDisplay = item.match_score !== undefined
            ? (item.match_score > 1 ? item.match_score : Math.round(item.match_score * 100))
            : '?';
        const lines = [
            `Empresa: ${item.display_name}`,
            item.company_email ? `Contacto: ${item.company_email}` : null,
            item.op_types ? `Operación: ${item.op_types}` : null,
            item.pay_methods ? `Pago: ${item.pay_methods}` : null,
            item.availability ? `Disponibilidad: ${item.availability}` : null,
            `Score: ${scoreDisplay}%`,
            `Estado: ${item.status || 'NEW'}`,
        ].filter(Boolean).join('\n');

        Alert.alert(
            'Detalle del Match',
            lines,
            [
                { text: 'Cerrar', style: 'cancel' },
                {
                    text: 'Contactar empresa', onPress: () => {
                        console.log('[Matches] User pressed Contact for company_id=', item.company_id);
                    }
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const scoreDisplay = item.match_score !== undefined
            ? (item.match_score > 1 ? item.match_score : Math.round(item.match_score * 100))
            : '?';
        return (
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{item.display_name}</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>{scoreDisplay}%</Text></View>
                </View>

                {user?.type === 'empresa' ? (
                    <>
                        <Text style={styles.detail}>Experiencia: {item.experience_years} años</Text>
                        <Text style={styles.detail}>Licencias: {item.license_summ}</Text>
                        <Text style={styles.detail}>Op. Type: {item.op_types}</Text>
                        <Text style={styles.detail}>Pago: {item.pay_methods}</Text>
                    </>
                ) : (
                    <>
                        <Text style={styles.detail}>Operación: {item.op_types || 'N/A'}</Text>
                        <Text style={styles.detail}>Pago: {item.pay_methods || 'N/A'}</Text>
                        <Text style={styles.detail}>Disponibilidad: {item.availability || 'N/A'}</Text>
                        {item.company_email ? <Text style={styles.detail}>Contacto: {item.company_email}</Text> : null}
                    </>
                )}

                <TouchableOpacity style={styles.button} onPress={() => handleAccept(item)}>
                    <Text style={styles.buttonText}>{user?.type === 'empresa' ? 'Ver Perfil / Aceptar' : 'Ver Empresa / Contactar'}</Text>
                </TouchableOpacity>
            </View>
        );
    };

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
