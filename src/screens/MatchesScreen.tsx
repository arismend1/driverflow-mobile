import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Clipboard, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../api/config';

export default function MatchesScreen() {
    const { userInfo: user, token } = useContext(AuthContext);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMatches = async () => {
        try {
            const endpoint = user?.type === 'driver' ? 'matches/opportunities' : 'matches/candidates';
            const resp = await fetch(`${API_URL}/${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await resp.json();
            setMatches(data || []);
        } catch (e) {
            console.error('Fetch Matches Error:', e);
            Alert.alert('Error', 'No se pudieron cargar los resultados');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMatches();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMatches();
    };

    const handleStatusChange = async (matchId, newStatus) => {
        try {
            let endpointSuffix = '';
            if (newStatus === 'ACCEPTED') {
                endpointSuffix = '/accept';
            } else if (newStatus === 'DECLINED') {
                Alert.alert('Error', 'La acción de rechazar aún no está soportada por el servidor.');
                return;
            } else {
                Alert.alert('Error', 'Acción desconocida');
                return;
            }

            const resp = await fetch(`${API_URL}/matches/${matchId}${endpointSuffix}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });

            if (resp.ok) {
                fetchMatches();
            } else {
                let errStr = 'Error desconocido';
                try {
                    const err = await resp.json();
                    errStr = err.error || 'No se pudo actualizar el estado';
                } catch (jsonErr) {
                    errStr = `Error HTTP ${resp.status}`;
                }
                Alert.alert('Error del Servidor', errStr);
            }
        } catch (e) {
            Alert.alert('Fallo de red', `Detalle: ${e.message}`);
        }
    };

    const handleConfirmShare = async (matchId) => {
        // Legal Consent Text
        const legalText = user?.type === 'driver'
            ? "Al confirmar, autorizas compartir tu email y teléfono con la empresa para fines de contacto laboral. Esta acción es irreversible."
            : "Al confirmar, autorizas compartir tu contacto con el conductor y aceptas los cargos correspondientes por el intercambio de información.";

        Alert.alert(
            'Consentimiento Legal',
            legalText,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Autorizar',
                    onPress: async () => {
                        try {
                            const endpoint = user?.type === 'driver' ? 'driver/confirm-share' : 'company/confirm-share';
                            const resp = await fetch(`${API_URL}/matches/${matchId}/${endpoint}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            if (resp.ok) {
                                fetchMatches();
                            } else {
                                const err = await resp.json();
                                Alert.alert('Error', err.error || 'No se pudo procesar el consentimiento');
                            }
                        } catch (e) {
                            Alert.alert('Error', 'Fallo de red');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        const matchId = item.id || item.match_id;
        const isStep1Accepted = item.status === 'ACCEPTED' ||
            item.status === 'PREMATCH_READY' ||
            item.status === 'SHARE_PENDING_DRIVER' ||
            item.status === 'SHARE_PENDING_COMPANY' ||
            item.status === 'INFO_SHARED';

        const isReadyForStep2 = item.status === 'PREMATCH_READY' ||
            item.status === 'SHARE_PENDING_DRIVER' ||
            item.status === 'SHARE_PENDING_COMPANY';

        const isStep2Accepted = (user?.type === 'driver' && item.driver_share_consent_at) ||
            (user?.type === 'empresa' && item.company_share_consent_at) ||
            item.status === 'INFO_SHARED';

        return (
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{user?.type === 'empresa' ? item.driver_name : 'Empresa Verificada'}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{Math.round((item.match_score || 0.85) * 100)}% Match</Text>
                    </View>
                </View>

                {item.status !== 'INFO_SHARED' ? (
                    <>
                        <Text style={styles.detail}>Ubicación: {item.ubicacion || 'A convenir'}</Text>
                        <Text style={styles.detail}>Licencia: {item.licencia_req || item.driver_license || 'B'}</Text>
                        <Text style={[styles.detail, styles.status]}>Estado: {item.status || 'N/A'}</Text>
                    </>
                ) : null}

                {/* Actions */}
                <View style={styles.actionsRow}>
                    {matchId == null ? (
                        <Text style={{ color: '#dc3545' }}>Error: match_id faltante</Text>
                    ) : item.status === 'INFO_SHARED' ? (
                        <View style={styles.sharedInfoBlock}>
                            <Text style={styles.sharedTitle}>✅ Contacto Compartido</Text>
                            <Text style={styles.sharedText}>¡Ya puedes contactar con la contraparte!</Text>

                            {user?.type === 'empresa' ? (
                                <>
                                    <Text style={styles.contactEmail}>{item.driver_email}</Text>
                                    {item.driver_phone ? <Text style={styles.contactPhone}>{item.driver_phone}</Text> : null}
                                </>
                            ) : (
                                <>
                                    <Text style={styles.contactEmail}>{item.company_email}</Text>
                                    {item.company_phone ? <Text style={styles.contactPhone}>{item.company_phone}</Text> : null}
                                </>
                            )}

                            <View style={styles.contactActions}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.btnEmail]}
                                    onPress={() => {
                                        const email = user?.type === 'empresa' ? item.driver_email : item.company_email;
                                        if (email) Linking.openURL(`mailto:${email}`);
                                    }}
                                >
                                    <Text style={styles.actionBtnText}>Enviar email</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.btnCopy]}
                                    onPress={() => {
                                        const email = user?.type === 'empresa' ? item.driver_email : item.company_email;
                                        if (email) {
                                            Clipboard.setString(email);
                                            Alert.alert('Copiado', 'Email copiado al portapapeles');
                                        }
                                    }}
                                >
                                    <Text style={styles.actionBtnText}>Copiar</Text>
                                </TouchableOpacity>

                                {(user?.type === 'empresa' ? item.driver_phone : item.company_phone) ? (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.btnCall]}
                                        onPress={() => {
                                            const phone = user?.type === 'empresa' ? item.driver_phone : item.company_phone;
                                            if (phone) Linking.openURL(`tel:${phone}`);
                                        }}>
                                        <Text style={styles.actionBtnText}>Llamar</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>
                    ) : user?.type === 'empresa' ? (
                        <>
                            {item.status === 'NEW' && !item.company_step1_accepted_at && (
                                <>
                                    {item.driver_step1_accepted_at && (
                                        <View style={{ backgroundColor: '#fff3cd', borderColor: '#ffeeba', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#856404' }}>Conductor interesado en tu empresa</Text>
                                            <Text style={{ color: '#856404', marginTop: 4 }}>Este conductor ya aceptó el match. Si aceptas, avanzarán al siguiente paso.</Text>
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonGreen]}
                                        onPress={() => handleStatusChange(matchId, 'ACCEPTED')}
                                    >
                                        <Text style={styles.buttonText}>Aceptar Match</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonRed]}
                                        onPress={() => handleStatusChange(matchId, 'DECLINED')}
                                    >
                                        <Text style={styles.buttonText}>Rechazar</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {item.company_step1_accepted_at && !item.driver_step1_accepted_at && (
                                <View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0056b3' }}>Esperando al otro usuario</Text>
                                    <Text style={{ textAlign: 'center', color: '#666', marginTop: 4 }}>Ya aceptaste este match. Estamos esperando que la otra parte confirme.</Text>
                                </View>
                            )}

                            {isReadyForStep2 && !isStep2Accepted && (
                                <View style={{ width: '100%' }}>
                                    <View style={{ marginBottom: 8 }}>
                                        <Text style={styles.consentPrompt}>Ambos aceptaron el match</Text>
                                        <Text style={styles.consentSub}>Ahora pueden decidir si compartir información de contacto.</Text>
                                        <Text style={styles.consentSub}>
                                            {!item.driver_share_consent_at ? '⏳ Esperando que el driver autorice...' : '✅ El driver autorizó compartir info.'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonBlue]}
                                        onPress={() => handleConfirmShare(matchId)}
                                    >
                                        <Text style={styles.buttonText}>Pagar y Ver Contacto</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {isStep2Accepted && item.status !== 'INFO_SHARED' && (
                                <Text style={styles.waitingText}>Esperando autorización mutua final...</Text>
                            )}
                        </>
                    ) : (
                        <>
                            {item.status === 'NEW' && !item.driver_step1_accepted_at && (
                                <>
                                    {item.company_step1_accepted_at && (
                                        <View style={{ backgroundColor: '#fff3cd', borderColor: '#ffeeba', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#856404' }}>Empresa interesada en ti</Text>
                                            <Text style={{ color: '#856404', marginTop: 4 }}>Esta empresa ya aceptó tu perfil. Si aceptas, avanzarán al siguiente paso.</Text>
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonGreen]}
                                        onPress={() => handleStatusChange(matchId, 'ACCEPTED')}
                                    >
                                        <Text style={styles.buttonText}>Aceptar Oferta</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonRed]}
                                        onPress={() => handleStatusChange(matchId, 'DECLINED')}
                                    >
                                        <Text style={styles.buttonText}>Rechazar</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {item.driver_step1_accepted_at && !item.company_step1_accepted_at && (
                                <View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0056b3' }}>Esperando al otro usuario</Text>
                                    <Text style={{ textAlign: 'center', color: '#666', marginTop: 4 }}>Ya aceptaste este match. Estamos esperando que la otra parte confirme.</Text>
                                </View>
                            )}

                            {isReadyForStep2 && !isStep2Accepted && (
                                <View style={{ width: '100%' }}>
                                    <View style={{ marginBottom: 8 }}>
                                        <Text style={styles.consentPrompt}>Ambos aceptaron el match</Text>
                                        <Text style={styles.consentSub}>Ahora pueden decidir si compartir información de contacto.</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonBlue]}
                                        onPress={() => handleConfirmShare(matchId)}
                                    >
                                        <Text style={styles.buttonText}>Confirmar Consentimiento</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {isStep2Accepted && item.status !== 'INFO_SHARED' && (
                                <Text style={styles.waitingText}>Esperando facturación de la empresa...</Text>
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
            <Text style={styles.pageTitle}>Panel de Matches</Text>

            {matches.length === 0 ? (
                <View style={styles.empty}>
                    {user?.type === 'driver' ? (
                        <>
                            <Text style={styles.emptyTitle}>Tu perfil está activo ✅</Text>
                            <Text style={styles.emptyText}>
                                Por ahora no hay oportunidades disponibles. Desliza para refrescar.
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.emptyTitle}>Buscando candidatos...</Text>
                            <Text style={styles.emptyText}>
                                No hay drivers disponibles. Refresca en unos minutos.
                            </Text>
                        </>
                    )}
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => String(item.match_id || item.id)}
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
    pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },

    card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 18, fontWeight: 'bold', flex: 1, paddingRight: 10, color: '#333' },

    badge: { backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    detail: { fontSize: 14, color: '#666', marginBottom: 5 },
    status: { fontWeight: 'bold', color: '#007bff' },

    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 },

    button: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', marginTop: 6, minWidth: 120 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    buttonGreen: { backgroundColor: '#28a745' },
    buttonRed: { backgroundColor: '#dc3545' },
    buttonBlue: { backgroundColor: '#007bff' },

    sharedInfoBlock: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#c8e6c9' },
    sharedTitle: { color: '#2e7d32', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
    sharedText: { color: '#444', marginBottom: 12, fontSize: 13 },

    contactEmail: { fontSize: 15, color: '#333', fontWeight: 'bold', marginBottom: 4 },
    contactPhone: { fontSize: 15, color: '#333', marginBottom: 10 },
    contactActions: { flexDirection: 'row', gap: 8, marginTop: 5 },
    actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flex: 1, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    btnEmail: { backgroundColor: '#007bff' },
    btnCopy: { backgroundColor: '#6c757d' },
    btnCall: { backgroundColor: '#28a745' },

    waitingText: { color: '#007bff', fontStyle: 'italic', marginTop: 8, fontSize: 13 },
    consentPrompt: { fontSize: 14, color: '#333', fontWeight: 'bold' },
    consentSub: { fontSize: 12, color: '#666' },

    empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
    emptyText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 },
});