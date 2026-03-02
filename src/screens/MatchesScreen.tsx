import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';

type MatchRow = {
    match_id?: number;
    id?: number;
    display_name?: string;

    // score + status
    match_score?: number;
    status?: string;

    // company side fields
    experience_years?: number | string;
    license_summ?: string;
    op_types?: string;
    pay_methods?: string;

    // driver side fields
    availability?: string;
    company_email?: string;
};

export default function MatchesScreen() {
    const { token, userInfo: user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [matches, setMatches] = useState<MatchRow[]>([]);

    const getActiveToken = useCallback(async (): Promise<string | null> => {
        if (token && token.trim().length > 0) return token;

        // Fallbacks for older builds / different auth storage keys
        const possibleKeys = ['auth_token', 'token', 'access_token', 'jwt'];
        for (const k of possibleKeys) {
            const v = await AsyncStorage.getItem(k);
            if (v && v.trim().length > 0) return v;
        }
        return null;
    }, [token]);

    const normalizeMatchesPayload = (payload: any): MatchRow[] => {
        // Backend may return array, or wrap it in { matches: [...] } / { data: [...] }
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.matches)) return payload.matches;
        if (payload && Array.isArray(payload.data)) return payload.data;
        return [];
    };

    const loadMatches = useCallback(async () => {
        setLoading(true);
        try {
            const activeToken = await getActiveToken();
            const endpoint = user?.type === 'empresa' ? '/matches/candidates' : '/matches/opportunities';
            const url = `${API_URL}${endpoint}`;

            console.log(`[Matches] url=${url}`);
            console.log(`[Matches] context token: ${token ? 'EXISTS len=' + token.length : 'NULL'}`);
            console.log(`[Matches] activeToken: ${activeToken ? 'EXISTS len=' + activeToken.length : 'NULL'}`);
            console.log(`[Matches] user.type=${user?.type} user.id=${(user as any)?.id}`);

            if (!activeToken) {
                console.warn('[Matches] No token available — aborting fetch');
                setMatches([]);
                return;
            }

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${activeToken}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log(`[Matches] status=${res.status} ok=${res.ok}`);

            if (res.ok) {
                const json = await res.json();
                const rows = normalizeMatchesPayload(json);
                console.log(`[Matches] received ${rows.length} matches`);
                setMatches(rows);
            } else {
                const errBody = await res.text();
                console.error(`[Matches] error response: ${errBody}`);

                // Make failures visible (otherwise user just sees empty and thinks "no matches")
                if (res.status === 401 || res.status === 403) {
                    Alert.alert('Sesión', 'Tu sesión no está autorizada. Vuelve a iniciar sesión.');
                } else {
                    Alert.alert('Error', `No se pudieron cargar los matches. (${res.status})`);
                }

                setMatches([]);
            }
        } catch (e) {
            console.error('[Matches] fetch exception:', e);
            Alert.alert('Error', 'Problema de conexión al cargar matches.');
            setMatches([]);
        } finally {
            setLoading(false);
        }
    }, [getActiveToken, token, user?.type, user]);

    useEffect(() => {
        // Depend on token + user.type so we retry once async bootstrap finishes
        loadMatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user?.type]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadMatches();
        } finally {
            setRefreshing(false);
        }
    }, [loadMatches]);

    const getMatchId = (m: MatchRow) => (typeof m.match_id === 'number' ? m.match_id : typeof m.id === 'number' ? m.id : null);

    const handleStatusChange = async (matchId: number, newStatus: string) => {
        try {
            const activeToken = await getActiveToken();
            if (!activeToken) {
                Alert.alert('Sesión', 'No hay token. Inicia sesión de nuevo.');
                return;
            }

            const actionMap: Record<string, string> = {
                VIEWED: 'viewed',
                CONTACTED: 'contacted',
                ACCEPTED: 'accept',
                DECLINED: 'decline',
            };
            const action = actionMap[newStatus] || newStatus.toLowerCase();

            const res = await fetch(`${API_URL}/matches/${matchId}/${action}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${activeToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (res.ok) {
                // Optimistic UI update
                if (newStatus === 'DECLINED') {
                    setMatches(prev => prev.filter(m => getMatchId(m) !== matchId));
                } else {
                    setMatches(prev => prev.map(m => (getMatchId(m) === matchId ? { ...m, status: newStatus } : m)));
                }
            } else {
                const errText = await res.text();
                console.error('[Matches] status update failed:', res.status, errText);
                Alert.alert('Error', `No se pudo actualizar el estado. (${res.status})`);
            }
        } catch (e) {
            console.error('[Matches] Error updating status:', e);
            Alert.alert('Error', 'Problema de conexión.');
        }
    };

    const renderItem = ({ item }: { item: MatchRow }) => {
        const scoreDisplay =
            item.match_score !== undefined && item.match_score !== null
                ? item.match_score > 1
                    ? Math.round(item.match_score)
                    : Math.round(item.match_score * 100)
                : '?';

        const matchId = getMatchId(item);

        return (
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{item.display_name || 'Sin nombre'}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{scoreDisplay}%</Text>
                    </View>
                </View>

                {user?.type === 'empresa' ? (
                    <>
                        <Text style={styles.detail}>Experiencia: {item.experience_years ?? 'N/A'} años</Text>
                        <Text style={styles.detail}>Licencias: {item.license_summ || 'N/A'}</Text>
                        <Text style={styles.detail}>Op. Type: {item.op_types || 'N/A'}</Text>
                        <Text style={styles.detail}>Pago: {item.pay_methods || 'N/A'}</Text>
                        <Text style={[styles.detail, styles.status]}>Estado: {item.status || 'N/A'}</Text>
                    </>
                ) : (
                    <>
                        <Text style={styles.detail}>Operación: {item.op_types || 'N/A'}</Text>
                        <Text style={styles.detail}>Pago: {item.pay_methods || 'N/A'}</Text>
                        <Text style={styles.detail}>Disponibilidad: {item.availability || 'N/A'}</Text>
                        {item.company_email ? <Text style={styles.detail}>Contacto: {item.company_email}</Text> : null}
                        <Text style={[styles.detail, styles.status]}>Estado: {item.status || 'N/A'}</Text>
                    </>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                    {matchId == null ? (
                        <Text style={{ color: '#dc3545' }}>Error: match_id faltante</Text>
                    ) : user?.type === 'empresa' ? (
                        <>
                            {item.status === 'NEW' && (
                                <TouchableOpacity
                                    style={[styles.button, styles.buttonDark]}
                                    onPress={() => handleStatusChange(matchId, 'VIEWED')}
                                >
                                    <Text style={styles.buttonText}>Marcar Visto</Text>
                                </TouchableOpacity>
                            )}

                            {(item.status === 'NEW' || item.status === 'VIEWED' || item.status === 'CONTACTED') && (
                                <>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonGreen]}
                                        onPress={() => handleStatusChange(matchId, 'ACCEPTED')}
                                    >
                                        <Text style={styles.buttonText}>Aceptar</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonRed]}
                                        onPress={() => handleStatusChange(matchId, 'DECLINED')}
                                    >
                                        <Text style={styles.buttonText}>Rechazar</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {item.status === 'ACCEPTED' && (
                                <Text style={{ color: '#28a745', fontWeight: 'bold', paddingVertical: 10 }}>
                                    Match Aceptado 🎉
                                </Text>
                            )}
                        </>
                    ) : (
                        <>
                            {(item.status === 'NEW' || item.status === 'VIEWED') && (
                                <TouchableOpacity
                                    style={[styles.button, styles.buttonBlue]}
                                    onPress={() => handleStatusChange(matchId, 'CONTACTED')}
                                >
                                    <Text style={styles.buttonText}>Contactar</Text>
                                </TouchableOpacity>
                            )}

                            {item.status === 'CONTACTED' && (
                                <>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonGreen]}
                                        onPress={() => handleStatusChange(matchId, 'ACCEPTED')}
                                    >
                                        <Text style={styles.buttonText}>Aceptar oferta</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonRed]}
                                        onPress={() => handleStatusChange(matchId, 'DECLINED')}
                                    >
                                        <Text style={styles.buttonText}>Rechazar</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {item.status === 'ACCEPTED' && (
                                <Text style={{ color: '#28a745', fontWeight: 'bold', paddingVertical: 10 }}>
                                    Oferta Aceptada 🎉
                                </Text>
                            )}
                        </>
                    )}
                </View>
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
                            <Text style={styles.emptyTitle}>Tu perfil está activo ✅</Text>
                            <Text style={styles.emptyText}>
                                Por ahora no hay ofertas disponibles para tu perfil. Desliza hacia abajo para refrescar.
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.emptyTitle}>Buscando candidatos...</Text>
                            <Text style={styles.emptyText}>
                                No hay drivers disponibles con los filtros actuales. Desliza hacia abajo para refrescar.
                            </Text>
                        </>
                    )}
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item, idx) => {
                        const id = getMatchId(item);
                        return id != null ? String(id) : String(idx);
                    }}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
    title: { fontSize: 18, fontWeight: 'bold', flex: 1, paddingRight: 10 },

    badge: { backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    detail: { fontSize: 14, color: '#666', marginBottom: 5 },
    status: { fontWeight: 'bold', color: '#007bff' },

    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 },

    button: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', marginTop: 6, minWidth: 110 },
    buttonText: { color: '#fff', fontWeight: 'bold' },

    buttonDark: { backgroundColor: '#000' },
    buttonGreen: { backgroundColor: '#28a745' },
    buttonRed: { backgroundColor: '#dc3545' },
    buttonBlue: { backgroundColor: '#17a2b8' },

    empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
    emptyText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 },
});