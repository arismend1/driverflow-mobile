// Keep build-mode selection independent of React Native so CI can test it.
export const selectApiMode = (isDevelopmentBuild: boolean): 'DEVICE_ADB' | 'PRODUCTION' =>
    isDevelopmentBuild ? 'DEVICE_ADB' : 'PRODUCTION';
