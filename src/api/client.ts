import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { clientConfig } from '@config/client';

export const api = axios.create({
  baseURL: clientConfig.api.url,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[API Request Guard] Auth check failed:', error.message);
    }

    const token = data?.session?.access_token;
    if (!token) {
      throw new Error('Request blocked: User is not authenticated.');
    }

    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) throw refreshError;

        const newToken = data?.session?.access_token;

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (authError) {
        console.error('[API Client] Session recovery failed. Redirecting to login...', authError);
      }
    }

    throw normalizeBackendError(error);
  },
);

/**
 * The API reports failures as `{ message }`; axios's default error.message
 * ("Request failed with status code 402") hides it, so users never see why a
 * request failed. Surface the backend message — UI layers read
 * `error.message` (getErrorMessage) — and keep the AxiosError as `cause`.
 */
function normalizeBackendError(error: unknown): unknown {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (typeof message !== 'string' || message.length === 0) {
    return error;
  }
  return new Error(message, { cause: error });
}
