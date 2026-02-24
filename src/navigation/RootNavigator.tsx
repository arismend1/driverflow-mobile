import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PinScreen from '../screens/PinScreen';
import HomeScreen from '../screens/HomeScreen';

import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { AvailableRequestsScreen } from '../screens/AvailableRequestsScreen';
import { CompanyBillingScreen } from '../screens/CompanyBillingScreen';
import CompanyProfileFormScreen from '../screens/CompanyProfileFormScreen';
import { CompanyRequestsScreen } from '../screens/CompanyRequestsScreen';
import CompanyRequirementsScreen from '../screens/CompanyRequirementsScreen';
import DriverProfileFormScreen from '../screens/DriverProfileFormScreen';
import DriverProfileScreen from '../screens/DriverProfileScreen';
import { DriverTicketsScreen } from '../screens/DriverTicketsScreen';
import MatchesScreen from '../screens/MatchesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

export type RootStackParamList = Record<string, any>;
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { isLoading, hasPin, token } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    const isAuthed = !!token;

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthed ? (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="PinScreen" component={PinScreen} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                    <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
                    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                </>
            ) : (
                <>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="AvailableRequests" component={AvailableRequestsScreen} />
                    <Stack.Screen name="CompanyBilling" component={CompanyBillingScreen} />
                    <Stack.Screen name="CompanyProfileForm" component={CompanyProfileFormScreen} />
                    <Stack.Screen name="CompanyRequests" component={CompanyRequestsScreen} />
                    <Stack.Screen name="CompanyRequirements" component={CompanyRequirementsScreen} />
                    <Stack.Screen name="DriverProfileForm" component={DriverProfileFormScreen} />
                    <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
                    <Stack.Screen name="DriverTickets" component={DriverTicketsScreen} />
                    <Stack.Screen name="Matches" component={MatchesScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}