import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { notifications, NotificationEvent } from '../api/NotificationsService';

export const NotificationsScreen = () => {
    const [events, setEvents] = useState<NotificationEvent[]>([]);

    useEffect(() => {
        // Subscribe to real-time events to update list
        const unsubscribe = notifications.addListener((newEvents) => {
            setEvents(prev => [...newEvents.reverse(), ...prev]); // Prepend new
        });
        return unsubscribe;
    }, []);

    const renderItem = ({ item }: { item: NotificationEvent }) => (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.key}>{item.key.toUpperCase().replace('_', ' ')}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            </View>
            <Text style={styles.body}>
                {JSON.stringify(item.data, null, 2)}
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.empty}>No new notifications</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 10
    },
    card: {
        backgroundColor: 'white',
        padding: 15,
        marginBottom: 10,
        borderRadius: 8,
        elevation: 2
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5
    },
    key: {
        fontWeight: 'bold',
        color: '#333'
    },
    date: {
        color: '#999',
        fontSize: 12
    },
    body: {
        color: '#555',
        fontSize: 14,
        fontFamily: 'monospace'
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        color: '#888'
    }
});
