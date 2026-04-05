/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/context/AuthContext', () => ({
    AuthProvider: ({ children }: any) => children,
    useAuth: () => ({ isLoading: false, userToken: null }),
}));

jest.mock('@react-navigation/native', () => {
    const ReactLib = require('react');
    return {
        __esModule: true,
        NavigationContainer: ({ children }: any) => ReactLib.createElement(ReactLib.Fragment, null, children),
    };
});

jest.mock('../src/navigation/RootNavigator', () => {
    const { Text } = require('react-native');
    return {
        __esModule: true,
        default: () => <Text>RootNavigator</Text>,
    };
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
