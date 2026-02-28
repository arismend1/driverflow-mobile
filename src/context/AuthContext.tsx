import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister } from '../api/client';

interface UserInfo {
    id: number;
    name: string;
    type: 'driver' | 'empresa';
    search_status?: string;
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
    pinGate: 'enter' | 'create' | null;
    clearPinGate: () => Promise<void>;
    pinReady: boolean;
    appLocked: boolean;
    lockApp: () => void;
    unlockApp: () => void;
    clearSavedCredentials: () => Promise<void>;
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
    pinGate: null,
    clearPinGate: async () => { },
    pinReady: false,
    appLocked: false,
    lockApp: () => { },
    unlockApp: () => { },
    clearSavedCredentials: async () => { },
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
    const [pinGate, setPinGate] = useState<'enter' | 'create' | null>(null);
    const [pinReady, setPinReady] = useState(false);
    const [appLocked, setAppLocked] = useState(false);

    useEffect(() => {
        const bootstrap = async () => {
            setIsLoading(true);
            try {
                // 1) Estado PIN
                const pin = await AsyncStorage.getItem(STORAGE_KEYS.savedPin);
                const email = await AsyncStorage.getItem(STORAGE_KEYS.savedEmail);
                const password = await AsyncStorage.getItem(STORAGE_KEYS.savedPassword);
                const type = await AsyncStorage.getItem(STORAGE_KEYS.savedType);

                const isPinReady = !!(pin && email && password && type);
                setPinReady(isPinReady);

                if (pin && email && type) {
                    setHasPin(true);
                    // console.log("[PIN] bootstrap existingPin? YES");
                    setPinGate('enter');
                } else if (!pin && email && type) {
                    console.log("[PIN] bootstrap existingPin? NO (but account remembered)");
                    setPinGate('create');
                } else {
                    if (pin) await AsyncStorage.removeItem(STORAGE_KEYS.savedPin);
                    setHasPin(false);
                    setPinGate(null);
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

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if ((nextAppState === 'background' || nextAppState === 'inactive') && pinReady) {
                // console.log("[AUTH] App backgrounded, locking...");
                setAppLocked(true);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [pinReady]);

    const lockApp = () => setAppLocked(true);
    const unlockApp = () => setAppLocked(false);

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

            const { token, id, name, type: serverType } = res.data as any;
            if (!token) throw new Error("NO_TOKEN_FROM_SERVER");

            const finalType: 'driver' | 'empresa' = (serverType || type) as any;
            const info: UserInfo = { id, name, type: finalType };

            // GUARDAR EN ASYNCSTORAGE PRIMERO
            await AsyncStorage.setItem('auth_token', token);
            await AsyncStorage.setItem('auth_user_info', JSON.stringify(info));

            // VALIDAR
            const saved = await AsyncStorage.getItem('auth_token');

            if (!saved || saved !== token) throw new Error("TOKEN_NOT_PERSISTED");

            // SOLO DESPUÉS: SETEAR ESTADO
            setUserToken(token);
            setUserInfo(info);

            if (remember) {
                await AsyncStorage.setItem(STORAGE_KEYS.savedEmail, contacto);
                await AsyncStorage.setItem(STORAGE_KEYS.savedPassword, password);
                await AsyncStorage.setItem(STORAGE_KEYS.savedType, finalType);

                const existingPin = await AsyncStorage.getItem(STORAGE_KEYS.savedPin);
                // console.log("[PIN] login existingPin?", existingPin ? "YES" : "NO");
                setPinGate(existingPin ? 'enter' : 'create');

                setPinReady(!!(existingPin && password));
            } else {
                await AsyncStorage.removeItem(STORAGE_KEYS.savedEmail);
                await AsyncStorage.removeItem(STORAGE_KEYS.savedPassword);
                await AsyncStorage.removeItem(STORAGE_KEYS.savedType);
                await AsyncStorage.removeItem(STORAGE_KEYS.savedPin);
                setHasPin(false);
                setPinGate(null);
                setPinReady(false);
            }
        } catch (e: any) {
            console.error("[AUTH] login failed", e?.message || e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    };

    const clearPinGate = async () => {
        setPinGate(null);
    };

    const savePin = async (pin: string) => {
        // console.log("[PIN] saving pin len", pin?.length);
        await AsyncStorage.setItem(STORAGE_KEYS.savedPin, pin);
        setHasPin(true);

        const email = await AsyncStorage.getItem(STORAGE_KEYS.savedEmail);
        const password = await AsyncStorage.getItem(STORAGE_KEYS.savedPassword);
        const type = await AsyncStorage.getItem(STORAGE_KEYS.savedType);
        setPinReady(!!(pin && email && password && type));
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
            if (!token) throw new Error("NO_TOKEN_FROM_SERVER");

            const finalType: 'driver' | 'empresa' = (serverType || type) as any;
            const info: UserInfo = { id, name, type: finalType };

            // GUARDAR EN ASYNCSTORAGE PRIMERO
            await AsyncStorage.setItem('auth_token', token);
            await AsyncStorage.setItem('auth_user_info', JSON.stringify(info));

            // VALIDAR
            const saved = await AsyncStorage.getItem('auth_token');

            if (!saved || saved !== token) throw new Error("TOKEN_NOT_PERSISTED");

            // SOLO DESPUÉS: SETEAR ESTADO
            setUserToken(token);
            setUserInfo(info);

            return true;
        } catch (error: any) {
            console.error("[AUTH] verifyPinAndLogin failed", error?.message || error);
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

            // Nota: NO borramos saved_pin aquí para permitir PIN login.
            // saved_email/saved_password/saved_type/saved_pin se mantienen.
        } catch (_) {
            // ignore
        } finally {
            setIsLoading(false);
        }
    };

    const clearSavedCredentials = async () => {
        setIsLoading(true);
        try {
            await AsyncStorage.removeItem(STORAGE_KEYS.savedEmail);
            await AsyncStorage.removeItem(STORAGE_KEYS.savedPassword);
            await AsyncStorage.removeItem(STORAGE_KEYS.savedType);
            await AsyncStorage.removeItem(STORAGE_KEYS.savedPin);
            setHasPin(false);
            setPinReady(false);
            setPinGate(null);
        } catch (e) {
            console.error("Error clearing credentials", e);
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
        pinGate,
        clearPinGate,
        pinReady,
        appLocked,
        lockApp,
        unlockApp,
        clearSavedCredentials,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;