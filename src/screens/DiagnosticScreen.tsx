import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Clipboard, Alert } from 'react-native';
import { DiagnosticsState, checkHealth } from '../api/client';

export const DiagnosticScreen = () => {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const refreshHealth = async () => {
        setLoading(true);
        try {
            const res = await checkHealth();
            setHealth(res.ok ? 'ONLINE (200)' : `ERROR ${res.status}`);
        } catch {
            setHealth('NETWORK_ERROR');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshHealth();
    }, []);

    const copyToClipboard = () => {
        const report = `
=== DRIVERFLOW DIAGNOSTIC ===
Date: ${new Date().toISOString()}
BaseURL: ${DiagnosticsState.baseUrl}
API Status: ${health}

Last Request ID: ${DiagnosticsState.lastRequestId}

Last Error:
${DiagnosticsState.lastError ? JSON.stringify(DiagnosticsState.lastError, null, 2) : 'None'}
==============================
        `;
        Clipboard.setString(report);
        Alert.alert('Copied', 'Diagnostic copied to clipboard.');
    };

    const pingEndpoint = async (ep: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${DiagnosticsState.baseUrl}${ep}`);
            const text = await res.text();
            Alert.alert(`Ping ${ep}`, `Status: ${res.status}\n\n${text.substring(0, 150)}`);
        } catch (e: any) {
            Alert.alert('Ping Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>System Diagnostic</Text>

            <View style={styles.card}>
                <Text style={styles.label}>API Status</Text>
                <Text style={[styles.value, { color: health?.includes('ONLINE') ? 'green' : 'red' }]}>{health || '...'}</Text>
                <Button title="Refresh Health" onPress={refreshHealth} disabled={loading} />

                <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-around' }}>
                    <Button title="Ping /healthz" onPress={() => pingEndpoint('/healthz')} disabled={loading} color="#444" />
                    <Button title="Ping /readyz" onPress={() => pingEndpoint('/readyz')} disabled={loading} color="#444" />
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Configuration</Text>
                <Text style={styles.mono}>URL: {DiagnosticsState.baseUrl}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Last Activity</Text>
                <Text style={styles.labelSmall}>Request-ID (Trace):</Text>
                <Text style={[styles.mono, { fontWeight: 'bold' }]}>{DiagnosticsState.lastRequestId}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Last Logged Error</Text>
                {DiagnosticsState.lastError ? (
                    <Text style={styles.errorText}>{JSON.stringify(DiagnosticsState.lastError, null, 2)}</Text>
                ) : (
                    <Text style={{ color: 'gray', fontStyle: 'italic' }}>No recent errors.</Text>
                )}
            </View>

            <View style={{ marginTop: 20 }}>
                <Button title="Copy Report" onPress={copyToClipboard} color="#666" />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f0f0f0' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 2 },
    label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#333' },
    labelSmall: { fontSize: 14, color: '#666', marginBottom: 2 },
    value: { fontSize: 18, marginBottom: 10 },
    mono: { fontFamily: 'monospace', fontSize: 12, backgroundColor: '#eee', padding: 5, borderRadius: 4 },
    errorText: { fontFamily: 'monospace', fontSize: 12, color: 'red', backgroundColor: '#fee', padding: 5 }
});
