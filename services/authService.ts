import * as AuthSession from 'expo-auth-session';
import { supabase } from '../utils/supabase';


export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

export async function signInWithGoogle() {
  const redirectUrl = AuthSession.makeRedirectUri({
    native: 'bookiq://auth', // Use your app.json scheme + path
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) throw error;

  // Open the browser for the user to complete the login
  // @ts-ignore: startAsync is available at runtime
  const result = await AuthSession.startAsync({ authUrl: data.url });

  // After successful login, Supabase will handle the session automatically
  return result;
} 