import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_FAILURE_KEY = 'pin_failed_attempts';
const PIN_LOCK_UNTIL_KEY = 'pin_lock_until';
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 30_000;

export default function PinLockOverlay() {
    const { verifyPinAndLogin, unlockApp, userInfo, clearSavedCredentials, logout } = useAuth();
    const [pin, setPin] = useState<string>('');
    const [isError, setIsError] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockUntil, setLockUntil] = useState(0);
    const [secondsRemaining, setSecondsRemaining] = useState(0);

    useEffect(() => {
        const restorePinProtection = async () => {
            const [attemptsRaw, lockRaw] = await Promise.all([
                AsyncStorage.getItem(PIN_FAILURE_KEY),
                AsyncStorage.getItem(PIN_LOCK_UNTIL_KEY),
            ]);
            const attempts = Number(attemptsRaw || 0);
            const until = Number(lockRaw || 0);
            setFailedAttempts(Number.isFinite(attempts) ? attempts : 0);
            setLockUntil(Number.isFinite(until) ? until : 0);
        };
        restorePinProtection().catch(() => {});
    }, []);

    useEffect(() => {
        if (lockUntil <= Date.now()) {
            setSecondsRemaining(0);
            return;
        }
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
            setSecondsRemaining(remaining);
            if (remaining === 0) {
                setLockUntil(0);
                setFailedAttempts(0);
                AsyncStorage.multiRemove([PIN_FAILURE_KEY, PIN_LOCK_UNTIL_KEY]).catch(() => {});
            }
        };
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [lockUntil]);

    useEffect(() => {
        if (pin.length === 4) {
            handlePinComplete(pin);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin]);

    const handlePinComplete = async (enteredPin: string) => {
        if (lockUntil > Date.now()) {
            setPin('');
            return;
        }

        const success = await verifyPinAndLogin(enteredPin);

        if (!success) {
            const nextAttempts = failedAttempts + 1;
            if (nextAttempts >= MAX_PIN_ATTEMPTS) {
                const until = Date.now() + PIN_LOCK_MS;
                setFailedAttempts(nextAttempts);
                setLockUntil(until);
                await AsyncStorage.multiSet([
                    [PIN_FAILURE_KEY, String(nextAttempts)],
                    [PIN_LOCK_UNTIL_KEY, String(until)],
                ]);
            } else {
                setFailedAttempts(nextAttempts);
                await AsyncStorage.setItem(PIN_FAILURE_KEY, String(nextAttempts));
            }
            triggerError();
            return;
        }

        await AsyncStorage.multiRemove([PIN_FAILURE_KEY, PIN_LOCK_UNTIL_KEY]);
        setFailedAttempts(0);
        setLockUntil(0);
        unlockApp();
        setPin('');
    };

    const triggerError = () => {
        setIsError(true);
        setPin('');
        setTimeout(() => setIsError(false), 500);
    };

    const handleKeyPress = (num: string) => {
        if (lockUntil <= Date.now() && pin.length < 4) setPin(prev => prev + num);
    };

    const handleBackspace = () => {
        if (lockUntil <= Date.now()) setPin(prev => prev.slice(0, -1));
    };

    const renderDots = () => {
        const dots = [];
        for (let i = 0; i < 4; i++) {
            const dotStyle: StyleProp<ViewStyle> = [
                styles.dot,
                pin.length > i ? styles.dotFilled : null,
                isError ? styles.dotError : null,
            ];
            // @ts-ignore
            dots.push(<View key={`dot-${i}`} style={dotStyle} />);
        }
        return <View style={styles.dotsContainer}>{dots}</View>;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Unlock DriverFlow</Text>
                {userInfo?.name ? <Text style={styles.subtitle}>Hello, {userInfo.name}</Text> : null}
                {secondsRemaining > 0
                    ? <Text style={styles.errorText}>Too many attempts. Try again in {secondsRemaining}s.</Text>
                    : isError
                        ? <Text style={styles.errorText}>Incorrect PIN. Try again.</Text>
                        : null}
            </View>

            {renderDots()}

            <View style={styles.numpad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <TouchableOpacity key={num} style={styles.numKey} onPress={() => handleKeyPress(num)}>
                        <Text style={styles.numText}>{num}</Text>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.numKey} onPress={() => { if (lockUntil <= Date.now()) setPin(''); }}>
                    <Text style={styles.actionText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.numKey} onPress={() => handleKeyPress('0')}>
                    <Text style={styles.numText}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.numKey} onPress={handleBackspace}>
                    <Text style={styles.actionText}>⌫</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.switchAccountButton}
                onPress={async () => {
                    // Safety: if we switch account while locked, we must unlock first or just logout and navigator will handle it
                    // but the modal is tied to appLocked state. logout should ideally unlock or navigator will redirect.
                    await logout();
                    await clearSavedCredentials();
                    unlockApp(); 
                }}
            >
                <Text style={styles.switchAccountText}>Switch account</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
        minHeight: 80,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6c757d',
    },
    errorText: {
        color: '#dc3545',
        marginTop: 10,
        fontWeight: '500',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 50,
    },
    dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#007BFF',
        marginHorizontal: 12,
    },
    dotFilled: {
        backgroundColor: '#007BFF',
    },
    dotError: {
        borderColor: '#dc3545',
        backgroundColor: 'transparent',
    },
    numpad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        width: 300,
        gap: 20,
    },
    numKey: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    numText: {
        fontSize: 32,
        fontWeight: '600',
        color: '#212529',
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#495057',
    },
    switchAccountButton: {
        marginTop: 30,
        padding: 10,
    },
    switchAccountText: {
        color: '#007BFF',
        fontSize: 16,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
