import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

export default function LegalAcceptanceScreen() {
    const { restrictedToken, completeLegalAcceptance, logout } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        if (!restrictedToken) {
            Alert.alert("Error", "No authentication token found. Please log in again.");
            return;
        }

        setLoading(true);
        try {
            const res = await request('/api/legal/accept', 'POST', {
                accept_terms: true,
                accept_privacy: true
            }, restrictedToken);

            if (!res.ok) {
                throw new Error(res.error || 'Failed to communicate with server');
            }

            // res.data.token contains the unlocked JWT
            if (res.data && res.data.token) {
                await completeLegalAcceptance(res.data.token);
            } else {
                throw new Error("Server did not return a valid unlocked token.");
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'There was a problem confirming your acceptance.');
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = () => {
        Alert.alert(
            "Terms Required",
            "You cannot use the DriverFlow platform without accepting the operating terms and privacy policies.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Log Out", style: "destructive", onPress: () => logout() }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Update to Terms of Service</Text>
            </View>

            <ScrollView style={styles.contentContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.paragraph}>
                    DriverFlow has updated its operation terms to comply with platform distribution standards. 
                    Before continuing to your dashboard, you must thoroughly review and accept the latest 
                    <Text style={styles.bold}> Terms of Service</Text> and <Text style={styles.bold}>Privacy Policy</Text>.
                </Text>
                
                <View style={styles.bulletList}>
                    <Text style={styles.bullet}>• Liability limitations during matchmaking.</Text>
                    <Text style={styles.bullet}>• Processing of Stripe billing metadata.</Text>
                    <Text style={styles.bullet}>• Firebase messaging compliance architecture.</Text>
                    <Text style={styles.bullet}>• Explicit data sovereignty regarding candidate profiles.</Text>
                </View>

                <Text style={styles.paragraph}>
                    By clicking "I Accept", you acknowledge that you have read and agreed to these conditions.
                    Refusing to consent will securely lock your account until the terms are accepted.
                </Text>
            </ScrollView>

            <View style={styles.footer}>
                {loading ? (
                    <ActivityIndicator size="large" color="#007BFF" />
                ) : (
                    <>
                        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                            <Text style={styles.acceptButtonText}>I Accept</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
                            <Text style={styles.declineButtonText}>I Decline</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#212529',
        textAlign: 'center',
    },
    contentContainer: {
        flex: 1,
        padding: 20,
    },
    paragraph: {
        fontSize: 16,
        color: '#495057',
        lineHeight: 24,
        marginBottom: 20,
    },
    bold: {
        fontWeight: 'bold',
        color: '#212529',
    },
    bulletList: {
        backgroundColor: '#e9ecef',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
    },
    bullet: {
        fontSize: 15,
        color: '#495057',
        marginBottom: 8,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: 40,
    },
    acceptButton: {
        backgroundColor: '#007BFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    declineButton: {
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    declineButtonText: {
        color: '#dc3545',
        fontSize: 16,
        fontWeight: '600',
    },
});
