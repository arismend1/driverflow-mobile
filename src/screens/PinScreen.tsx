import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

type Step = 'enter' | 'create' | 'confirm';

export default function PinScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    const { hasPin, savePin, verifyPinAndLogin, logout, userInfo, token, clearPinGate, unlockApp, clearSavedCredentials, appLocked } = useAuth();

    // mode puede venir de Login: { mode: 'create' }
    const forcedMode: 'create' | undefined = route?.params?.mode === 'create' ? 'create' : undefined;

    const initialStep: Step = useMemo(() => {
        if (forcedMode === 'create') return 'create';
        return hasPin ? 'enter' : 'create';
    }, [forcedMode, hasPin]);

    const [pin, setPin] = useState<string>('');
    const [confirmPin, setConfirmPin] = useState<string>('');
    const [step, setStep] = useState<Step>(initialStep);
    const [isError, setIsError] = useState(false);

    // Si cambia hasPin (por ejemplo después de guardar), ajusta el step solo si no está forzado
    useEffect(() => {
        if (forcedMode === 'create') return;
        setStep(hasPin ? 'enter' : 'create');
    }, [hasPin, forcedMode]);

    useEffect(() => {
        if (pin.length === 4) {
            handlePinComplete(pin);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin]);

    const handlePinComplete = async (enteredPin: string) => {
        if (step === 'enter') {
            console.log(`[PIN] step=enter | entered length=${enteredPin.length}`);
            console.log(`[PIN] calling verifyPinAndLogin...`);

            const success = await verifyPinAndLogin(enteredPin);

            console.log(`[PIN] verifyPinAndLogin result=${success}`);

            if (!success) {
                console.log(`[PIN] PIN FAILED — triggering error`);
                triggerError();
                return;
            }

            console.log(`[PIN] PIN OK — clearing gate and unlocking`);
            await clearPinGate();
            unlockApp();
            setPin('');
            console.log(`[PIN] unlockApp() called — appLocked should now be false`);
            return;
        }

        if (step === 'create') {
            setConfirmPin(enteredPin);
            setPin('');
            setStep('confirm');
            return;
        }

        // confirm
        if (enteredPin === confirmPin) {
            console.log(`[PIN] create+confirm matched — saving PIN`);
            await savePin(enteredPin);
            await clearPinGate();
            unlockApp();
            setPin('');
            setConfirmPin('');
            console.log(`[PIN] navigating to Home`);
            navigation.navigate('Home');
            return;
        }

        triggerError();
        setStep('create');
        setConfirmPin('');
    };

    const triggerError = () => {
        setIsError(true);
        setPin('');
        setTimeout(() => setIsError(false), 500);
    };

    const handleKeyPress = (num: string) => {
        if (pin.length < 4) setPin(prev => prev + num);
    };

    const handleBackspace = () => setPin(prev => prev.slice(0, -1));

    const handleLogout = async () => {
        await logout();
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
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

    const getTitle = () => {
        if (step === 'enter') return 'Ingresa tu PIN';
        if (step === 'create') return 'Crea tu PIN de acceso';
        return 'Confirma tu PIN';
    };

    const showSubtitle = step === 'enter' && userInfo?.name;
    const showError = isError && (step === 'enter' ? 'PIN incorrecto. Intenta de nuevo.' : 'Los PIN no coinciden.');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{getTitle()}</Text>

                {showSubtitle ? <Text style={styles.subtitle}>Hola, {userInfo!.name}</Text> : null}

                {!!showError ? <Text style={styles.errorText}>{showError}</Text> : null}

                {/* Debug opcional (si quieres ver si hay token) */}
                {/* <Text>{token ? 'TOKEN OK' : 'NO TOKEN'}</Text> */}
            </View>

            {renderDots()}

            <View style={styles.numpad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <TouchableOpacity key={num} style={styles.numKey} onPress={() => handleKeyPress(num)}>
                        <Text style={styles.numText}>{num}</Text>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.numKey} onPress={() => setPin('')}>
                    <Text style={styles.actionText}>Limpiar</Text>
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
                    await clearSavedCredentials();
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }}
            >
                <Text style={styles.switchAccountText}>Cambiar cuenta</Text>
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