import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { login as apiLogin, register as apiRegister, request, setLegalAcceptanceInterceptor } from '../api/client';

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
    suppressPinLock: () => void;
    resumePinLock: () => void;
    clearSavedCredentials: () => Promise<void>;
    updateUserSearchStatus: (status: string) => Promise<void>;
    needsLegalAccept: boolean;
    restrictedToken: string | null;
    completeLegalAcceptance: (unlockedToken: string) => Promise<void>;
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
    suppressPinLock: () => { },
    resumePinLock: () => { },
    clearSavedCredentials: async () => { },
    updateUserSearchStatus: async () => { },
    needsLegalAccept: false,
    restrictedToken: null,
    completeLegalAcceptance: async () => { },
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
    restrictedToken: 'restricted_token',
};

const getSafeMessaging = () => {
    try {
        // This check prevents "No Firebase App '[DEFAULT]' has been created" crash
        return messaging();
    } catch (e) {
        console.warn("[PUSH] Firebase Messaging failed to initialize (Normal if native config is missing):", (e as any).message);
        return null;
    }
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [userToken, setUserToken] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasPin, setHasPin] = useState(false);
    const [pinGate, setPinGate] = useState<'enter' | 'create' | null>(null);
    const [pinReady, setPinReady] = useState(false);
    const [appLocked, setAppLocked] = useState(false);
    const [needsLegalAccept, setNeedsLegalAccept] = useState(false);
    const [restrictedToken, setRestrictedToken] = useState<string | null>(null);
    const suppressLockRef = useRef(false);
    const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const needsLegalAcceptRef = useRef(false);

    useEffect(() => {
        needsLegalAcceptRef.current = needsLegalAccept;
    }, [needsLegalAccept]);

    // --- GLOBAL LEGAL INTERCEPTOR ---
    useEffect(() => {
        setLegalAcceptanceInterceptor(async (restrictedJwt) => {
            if (needsLegalAcceptRef.current) return;
            console.log("[AUTH GLOBAL] 403 Legal Intercepted (Stable). Raising gate.");
            setNeedsLegalAccept(true);
            setRestrictedToken(restrictedJwt);
            if (restrictedJwt) await AsyncStorage.setItem(STORAGE_KEYS.restrictedToken, restrictedJwt);
        });
    }, []);

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
                const restricted = await AsyncStorage.getItem(STORAGE_KEYS.restrictedToken);

                if (restricted) {
                    setRestrictedToken(restricted);
                    setNeedsLegalAccept(true);
                    return;
                }

                if (token) {
                    setUserToken(token);
                    // --- HOOK: Push Notification Registration (Bootstrap) ---
                    console.log("[PUSH] Bootstrap: Session found, calling registerPushToken...");
                    registerPushToken(token).catch((err) => {
                        console.error("[PUSH] Bootstrap: Error in call chain:", err);
                    });
                }

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
            if ((nextAppState === 'background' || nextAppState === 'inactive') && pinReady && !suppressLockRef.current) {
                console.log("[AUTH] App backgrounded, locking...");
                setAppLocked(true);
            } else if ((nextAppState === 'background' || nextAppState === 'inactive') && suppressLockRef.current) {
                console.log("[AUTH] App backgrounded but PIN lock SUPPRESSED (camera/gallery active)");
            }
        });

        return () => {
            subscription.remove();
        };
    }, [pinReady]);

    const lockApp = () => setAppLocked(true);
    const unlockApp = () => setAppLocked(false);

    const suppressPinLock = () => {
        console.log("[AUTH] PIN lock SUPPRESSED for trusted flow");
        suppressLockRef.current = true;
        // Safety timeout: auto-resume after 60 seconds
        if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
        suppressTimeoutRef.current = setTimeout(() => {
            console.warn("[AUTH] PIN lock suppression TIMEOUT — auto-resuming");
            suppressLockRef.current = false;
            suppressTimeoutRef.current = null;
        }, 60000);
    };

    const resumePinLock = () => {
        console.log("[AUTH] PIN lock RESUMED");
        suppressLockRef.current = false;
        if (suppressTimeoutRef.current) {
            clearTimeout(suppressTimeoutRef.current);
            suppressTimeoutRef.current = null;
        }
    };
    
    const registerPushToken = async (token: string) => {
        try {
            console.log("[PUSH] START");
            
            const messenger = getSafeMessaging();
            if (!messenger) {
                console.warn("[PUSH] skipping registration: Firebase not ready");
                return;
            }

            // 1. Device registration (official recommendation)
            await messenger.registerDeviceForRemoteMessages();
            
            // 2. Request permission (non-blocking)
            await messenger.requestPermission().catch((err) => {
                console.warn("[PUSH] ERROR (Permission):", err);
            });
            
            // 3. Get token
            const fcmToken = await messenger.getToken();
            console.log("[PUSH] TOKEN:", fcmToken);

            if (fcmToken) {
                console.log("[PUSH] Sending POST /api/push/register...");
                const res = await request('/api/push/register', 'POST', { token: fcmToken, platform: 'android' }, token);
                console.log("[PUSH] RESPONSE:", res.ok ? "OK" : "FAIL", "Status:", res.status, "Error:", res.error);
            } else {
                console.warn("[PUSH] ERROR: fcmToken is null");
            }
        } catch (e) {
            console.warn("[PUSH] ERROR (Fatal):", e);
        }
    };

    // --- REFRESH TOKEN LISTENER ---
    useEffect(() => {
        const messenger = getSafeMessaging();
        if (!messenger) return;

        const unsubscribe = messenger.onTokenRefresh(async fcmToken => {
            console.log("[PUSH] TOKEN REFRESH:", fcmToken);
            if (userToken) {
                try {
                    const res = await request('/api/push/register', 'POST', { token: fcmToken, platform: 'android' }, userToken);
                    console.log("[PUSH] REFRESH RESPONSE:", res.ok ? "OK" : "FAIL");
                } catch (e) {
                    console.error("[PUSH] REFRESH ERROR:", e);
                }
            }
        });
        return unsubscribe;
    }, [userToken]);
    
    // --- FOREGROUND HANDLER ---
    useEffect(() => {
        console.log('[PUSH] FOREGROUND effect mounted');
        const messenger = getSafeMessaging();
        if (!messenger) return;

        const unsubscribe = messenger.onMessage(async remoteMessage => {
            console.log('[PUSH] FOREGROUND callback fired');
            console.log('[PUSH] FOREGROUND:', remoteMessage);

            try {
                // Create a channel (required for Android)
                const channelId = await notifee.createChannel({
                    id: 'default',
                    name: 'Default Channel',
                    importance: AndroidImportance.HIGH,
                });

                // Display a notification
                await notifee.displayNotification({
                    title: remoteMessage?.notification?.title || 'Notificación',
                    body: remoteMessage?.notification?.body || '',
                    android: {
                        channelId,
                        smallIcon: 'ic_launcher', // standard icon
                        pressAction: {
                            id: 'default',
                        },
                    },
                });
                console.log('[PUSH] LOCAL DISPLAY success');
            } catch (err) {
                console.error('[PUSH] LOCAL DISPLAY error:', err);
            }
        });

        return unsubscribe;
    }, []);

    // --- BACKGROUND OPEN HANDLER ---
    useEffect(() => {
        const messenger = getSafeMessaging();
        if (!messenger) return;

        const unsubscribe = messenger.onNotificationOpenedApp(remoteMessage => {
            console.log('[PUSH] OPENED FROM BACKGROUND:', remoteMessage);
        });

        return unsubscribe;
    }, []);

    // --- QUIT STATE HANDLER ---
    useEffect(() => {
        console.log('[PUSH] QUIT effect mounted');
        const messenger = getSafeMessaging();
        if (!messenger) return;

        console.log('[PUSH] QUIT checked');
        messenger
            .getInitialNotification()
            .then(remoteMessage => {
                if (remoteMessage) {
                    console.log('[PUSH] QUIT message found');
                    console.log('[PUSH] OPENED FROM QUIT:', remoteMessage);
                } else {
                    console.log('[PUSH] QUIT no message');
                }
            })
            .catch(err => {
                console.warn('[PUSH] QUIT check failed:', err);
            });
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

            const { token, id, name, type: serverType, search_status } = res.data as any;
            if (!token) throw new Error("NO_TOKEN_FROM_SERVER");

            const finalType: 'driver' | 'empresa' = (serverType || type) as any;
            const info: UserInfo = { id, name, type: finalType, search_status: search_status || 'ON' };

            // GUARDAR EN ASYNCSTORAGE PRIMERO
            await AsyncStorage.setItem('auth_token', token);
            await AsyncStorage.setItem('auth_user_info', JSON.stringify(info));

            // VALIDAR
            const saved = await AsyncStorage.getItem('auth_token');

            if (!saved || saved !== token) throw new Error("TOKEN_NOT_PERSISTED");

            // SOLO DESPUÉS: SETEAR ESTADO
            setUserToken(token);
            setUserInfo(info);

            // --- HOOK: Push Notification Registration ---
            setTimeout(() => {
                registerPushToken(token).catch(() => {});
            }, 1000);

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

            if (savedPin === null) {
                // FAIL-OPEN: no PIN saved — treat as unlock, redirect handled by navigator

                return false;
            }

            const pinMatch = savedPin === enteredPin;

            if (!pinMatch) return false;

            // PIN matches — check if we have saved credentials for re-login
            const email = await AsyncStorage.getItem(STORAGE_KEYS.savedEmail);
            const password = await AsyncStorage.getItem(STORAGE_KEYS.savedPassword);
            const type = (await AsyncStorage.getItem(STORAGE_KEYS.savedType)) as 'driver' | 'empresa' | null;


            if (!email || !password || !type) {
                // UNLOCK-ONLY: PIN matched but no stored credentials.
                // User is already logged in (userToken exists from the session).
                // Just unlock — do NOT return false.

                return true;
            }

            // Full re-login with saved credentials
            const res = await apiLogin(email, password, type);

            if (res.data?.requires_legal_acceptance) {
                setNeedsLegalAccept(true);
                const rt = res.data.token || null;
                setRestrictedToken(rt);
                if (rt) await AsyncStorage.setItem(STORAGE_KEYS.restrictedToken, rt);
                return true;
            }

            if (!res.ok) {

                return false;
            }

            const { token, id, name, type: serverType } = res.data as any;
            if (!token) throw new Error("NO_TOKEN_FROM_SERVER");

            const finalType: 'driver' | 'empresa' = (serverType || type) as any;
            const info: UserInfo = { id, name, type: finalType, search_status: res.data.search_status || 'ON' };

            await AsyncStorage.setItem('auth_token', token);
            await AsyncStorage.setItem('auth_user_info', JSON.stringify(info));

            const saved = await AsyncStorage.getItem('auth_token');
            if (!saved || saved !== token) throw new Error("TOKEN_NOT_PERSISTED");

            setUserToken(token);
            setUserInfo(info);
            console.log(`[PIN] verifyPinAndLogin: re-login SUCCESS`);

            // --- HOOK: Push Notification Registration ---
            setTimeout(() => {
                registerPushToken(token).catch(() => {});
            }, 1000);
            
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
            setNeedsLegalAccept(false);
            setRestrictedToken(null);

            await AsyncStorage.removeItem(STORAGE_KEYS.token);
            await AsyncStorage.removeItem(STORAGE_KEYS.restrictedToken);
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

    const updateUserSearchStatus = async (status: string) => {
        if (!userInfo) return;
        const newInfo = { ...userInfo, search_status: status };
        setUserInfo(newInfo);
        await AsyncStorage.setItem('auth_user_info', JSON.stringify(newInfo));
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
        suppressPinLock,
        resumePinLock,
        clearSavedCredentials,
        updateUserSearchStatus,
        needsLegalAccept,
        restrictedToken,
        completeLegalAcceptance: async (unlockedToken: string) => {
            await AsyncStorage.setItem(STORAGE_KEYS.token, unlockedToken);
            await AsyncStorage.removeItem(STORAGE_KEYS.restrictedToken);
            setUserToken(unlockedToken);
            setNeedsLegalAccept(false);
            setRestrictedToken(null);
            setTimeout(() => {
                registerPushToken(unlockedToken).catch(() => {});
            }, 1000);
        }
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;