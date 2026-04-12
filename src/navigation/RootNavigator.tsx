import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Modal, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PinScreen from '../screens/PinScreen';
import PinLockOverlay from '../components/PinLockOverlay';
import HomeScreen from '../screens/HomeScreen';
import LegalAcceptanceScreen from '../screens/LegalAcceptanceScreen';

import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { AvailableRequestsScreen } from '../screens/AvailableRequestsScreen';
import { CompanyBillingScreen } from '../screens/CompanyBillingScreen';
import CompanyReactivationRequestsScreen from '../screens/CompanyReactivationRequestsScreen';
import CompanyProfileFormScreen from '../screens/CompanyProfileFormScreen';
import CompanyRequirementsScreen from '../screens/CompanyRequirementsScreen';
import DriverProfileFormScreen from '../screens/DriverProfileFormScreen';
import DriverProfileScreen from '../screens/DriverProfileScreen';
import { DriverTicketsScreen } from '../screens/DriverTicketsScreen';
import MatchesScreen from '../screens/MatchesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import CreateRequestScreen from '../screens/CreateRequestScreen';

export type RootStackParamList = Record<string, any>;
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { isLoading, token, pinGate, pinReady, appLocked, needsLegalAccept } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    const isAuthed = !!token;

    return (
        <View style={styles.root}>
            <Stack.Navigator screenOptions={{ headerShown: true }}>
                {needsLegalAccept ? (
                    <Stack.Screen name="LegalAcceptance" component={LegalAcceptanceScreen} options={{ headerShown: false }} />
                ) : !isAuthed ? (
                    <>
                        {pinReady ? (
                            <>
                                <Stack.Screen name="PinScreen" component={PinScreen} initialParams={{ mode: 'enter' }} options={{ headerShown: false }} />
                                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                            </>
                        ) : (
                            <>
                                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                                <Stack.Screen name="PinScreen" component={PinScreen} options={{ headerShown: false }} />
                            </>
                        )}
                        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
                        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                    </>
                ) : (
                    <>
                        {pinGate ? (
                            <>
                                <Stack.Screen
                                    name="PinScreen"
                                    component={PinScreen}
                                    initialParams={{ mode: pinGate }}
                                    options={{ headerShown: false }}
                                />
                                <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
                            </>
                        ) : (
                            <>
                                <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
                                <Stack.Screen name="PinScreen" component={PinScreen} options={{ headerShown: false }} />
                            </>
                        )}
                        <Stack.Screen name="AvailableRequests" component={AvailableRequestsScreen} />
                        <Stack.Screen name="CompanyBilling" component={CompanyBillingScreen} />
                        <Stack.Screen name="CompanyReactivationRequests" component={CompanyReactivationRequestsScreen} options={{ title: 'Employment Confirmations' }} />
                        <Stack.Screen name="CompanyProfileForm" component={CompanyProfileFormScreen} />
                        <Stack.Screen name="CompanyRequirements" component={CompanyRequirementsScreen} />
                        <Stack.Screen name="DriverProfileForm" component={DriverProfileFormScreen} />
                        <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
                        <Stack.Screen name="DriverTickets" component={DriverTicketsScreen} />
                        <Stack.Screen name="Matches" component={MatchesScreen} />
                        <Stack.Screen name="Notifications" component={NotificationsScreen} />
                        <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: 'New Job' }} />
                    </>
                )}
            </Stack.Navigator>

            <Modal visible={appLocked === true} animationType="fade" transparent={false}>
                <PinLockOverlay />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    root: {
        flex: 1,
    },
});
