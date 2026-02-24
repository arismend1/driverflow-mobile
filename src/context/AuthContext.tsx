import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister } from '../api/client';

interface UserInfo {
    id: number;
    name: string;
    type: 'driver' | 'empresa';
}

interface AuthContextType {
    userToken: string | null;
    token: string | null;
    userInfo: UserInfo | null;
    adminToken: string | null;
    isLoading: boolean;
    hasPin: boolean;

    login: (
        contacto: string,
        password: string,
        type: 'driver' | 'empresa',
        remember?: boolean
    ) => Promise<void>;

    verifyPinAndLogin: (pin: string) => Promise<boolean>;
    savePin: (pin: string) => Promise<void>;
    register: (data: any) => Promise<any>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
    userToken: null,
    token: null,
    userInfo: null,
    adminToken: null,
    isLoading: true,
    hasPin: false,
    login: async () => { },
    verifyPinAndLogin: async () => false,
    savePin: async () => { },
    register: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
    children: ReactNode;
}

const STORAGE_KEYS = {
    token: 'auth_token',
    userInfo: 'auth_user_info',
    savedPin: 'saved_pin',
    savedEmail: 'saved_email',
    savedPassword: 'saved_password',
    savedType: 'saved_type',
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [userToken, setUserToken] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasPin, setHasPin] = useState(false);

    useEffect(() => {
        const bootstrap = async () => {
            setIsLoading(true);
            try {
                // 1) Estado PIN
                const pin = await AsyncStorage.getItem(STORAGE_KEYS.savedPin);
                const email = await AsyncStorage.getItem(STORAGE_KEYS.savedEmail);
                const type = await AsyncStorage.getItem(STORAGE_KEYS.savedType);

                if (pin && email && type) {
                    setHasPin(true);
                } else {
                    if (pin) await AsyncStorage.removeItem(STORAGE_KEYS.savedPin);
                    setHasPin(false);
                }

                // 2) Restaurar sesión (TOKEN + USERINFO)
                const token = await AsyncStorage.getItem(STORAGE_KEYS.token);
                const userInfoRaw = await AsyncStorage.getItem(STORAGE_KEYS.userInfo);

                if (token) setUserToken(token);

                if (userInfoRaw) {
                    try {
                        const parsed = JSON.parse(userInfoRaw) as UserInfo;
                        if (parsed?.id && parsed?.type) setUserInfo(parsed);
                    } catch {
                        await AsyncStorage.removeItem(STORAGE_KEYS.userInfo);
                    }
                }
            } catch (e) {
                console.error('Error bootstrapping Auth state', e);
            } finally {
                setIsLoading(false);
            }
        };

        bootstrap();
    }, []);

    const login = async (
        contacto: string,
        password: string,
        type: 'driver' | 'empresa',
        remember: boolean = false
    ) => {
        setIsLoading(true);
        try {
            const res = await apiLogin(contacto, password, type);
            if (!res.ok) throw new Error(res.error || 'Login failed');

            // IMPORTANTE: usa el type que devuelve el backend si viene
            const { token, id, name, type: serverType } = res.data as any;

            const finalType: 'driver' | 'empresa' = (serverType || type) as any;
            const info: UserInfo = { id, name, type: finalType };

            setUserToken(token);
            setUserInfo(info);

            await AsyncStorage.setItem(STORAGE_KEYS.token, token);
            await AsyncStorage.setItem(STORAGE_KEYS.userInfo, JSON.stringify(info));

            if (remember) {
                await AsyncStorage.setItem(STORAGE_KEYS.savedEmail, contacto);
                await AsyncStorage.setItem(STORAGE_KEYS.savedPassword, password);
                await AsyncStorage.setItem(STORAGE_KEYS.savedType, finalType);
            } else {
                await AsyncStorage.removeItem(STORAGE_KEYS.savedEmail);
                await AsyncStorage.removeItem(STORAGE_KEYS.savedPassword);
                await AsyncStorage.removeItem(STORAGE_KEYS.savedType);
                await AsyncStorage.removeItem(STORAGE_KEYS.savedPin);
                setHasPin(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const savePin = async (pin: string) => {
        await AsyncStorage.setItem(STORAGE_KEYS.savedPin, pin);
        setHasPin(true);
    };

    const verifyPinAndLogin = async (enteredPin: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const savedPin = await AsyncStorage.getItem(STORAGE_KEYS.savedPin);
            if (savedPin !== enteredPin) return false;

            const email = await AsyncStorage.getItem(STORAGE_KEYS.savedEmail);
            const password = await AsyncStorage.getItem(STORAGE_KEYS.savedPassword);
            const type = (await AsyncStorage.getItem(STORAGE_KEYS.savedType)) as
                | 'driver'
                | 'empresa'
                | null;

            if (!email || !password || !type) return false;

            const res = await apiLogin(email, password, type);
            if (!res.ok) return false;

            const { token, id, name, type: serverType } = res.data as any;
            const finalType: 'driver' | 'empresa' = (serverType || type) as any;

            const info: UserInfo = { id, name, type: finalType };

            setUserToken(token);
            setUserInfo(info);

            await AsyncStorage.setItem(STORAGE_KEYS.token, token);
            await AsyncStorage.setItem(STORAGE_KEYS.userInfo, JSON.stringify(info));

            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (data: any) => {
        setIsLoading(true);
        try {
            const res = await apiRegister(data);
            if (!res.ok) throw new Error(res.error || 'Registration failed');
            return res.data;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            setUserToken(null);
            setUserInfo(null);

            await AsyncStorage.removeItem(STORAGE_KEYS.token);
            await AsyncStorage.removeItem(STORAGE_KEYS.userInfo);

            // Nota: NO borramos saved_email/saved_password/saved_pin aquí para permitir PIN login.
        } catch (_) {
            // ignore
        } finally {
            setIsLoading(false);
        }
    };

    const value: AuthContextType = {
        userToken,
        token: userToken,
        userInfo,
        adminToken: null,
        isLoading,
        hasPin,
        login,
        savePin,
        verifyPinAndLogin,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;