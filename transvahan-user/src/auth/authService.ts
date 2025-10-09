// transvahan-user/src/auth/authService.ts
import Constants from 'expo-constants';
import { apiClient } from '../api/client';
import { mockApi } from '../api/mockServer';
import { setToken } from '../api/client';


const USE_MOCK = Constants?.expoConfig?.extra?.USE_MOCK;


export const AuthAPI = USE_MOCK ? mockApi : apiClient;


export const login = async (email: string, password: string) => {
const { token, user } = await AuthAPI.login({ email, password });
setToken(token);
return user;
};