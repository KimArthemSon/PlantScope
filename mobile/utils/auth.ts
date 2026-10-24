import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

export const TOKEN_KEY = "token";
export const USER_ROLE_KEY = "user_role";

export const getToken = async (): Promise<string | null> => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const getCachedRole = async (): Promise<string | null> => {
  if (Platform.OS === "web") return localStorage.getItem(USER_ROLE_KEY);
  return await SecureStore.getItemAsync(USER_ROLE_KEY);
};

export const clearAuthData = async () => {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ROLE_KEY);
  }
};

/** 401/403 means the token is expired or invalid. */
export const isAuthFailure = (status: number) =>
  status === 401 || status === 403;

export type SessionResult =
  | { status: "no_token" }
  | { status: "invalid" }
  | { status: "valid"; role: string | null; user: any }
  | { status: "unreachable"; role: string | null }; // offline / server error / timeout

/**
 * Checks the stored token against the server.
 * Only "no_token" and "invalid" mean the user must log in again;
 * "unreachable" means we couldn't verify (offline, timeout, server error).
 */
export const checkSession = async (
  signal?: AbortSignal,
): Promise<SessionResult> => {
  const token = await getToken();
  if (!token) return { status: "no_token" };

  try {
    const res = await fetch(`${api}/api/get_me/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal,
    });
    if (isAuthFailure(res.status)) return { status: "invalid" };
    if (!res.ok) return { status: "unreachable", role: await getCachedRole() };
    const user = await res.json();
    return { status: "valid", role: user?.user_role ?? null, user };
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    return { status: "unreachable", role: await getCachedRole() };
  }
};
