import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * Shape of errors surfaced to React Query `onError` callbacks. The response
 * interceptor rejects with a real `Error` onto which the server's error body
 * (e.g. `code`, `censoredEmail`) is merged; some call sites also probe the
 * raw axios `response`. All fields are optional — narrow before use.
 */
export interface ApiError extends Error {
  code?: string;
  censoredEmail?: string;
  email?: string;
  autoLinkToken?: string;
  response?: { data?: { code?: string; data?: { limit?: number | string } } };
}

function getAPIBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.startsWith("dev.")) return "https://dev.api.iom.betterinternship.com";
    if (host.endsWith(".betterinternship.com")) return "https://api.iom.betterinternship.com";
  }
  return process.env.NEXT_PUBLIC_IOM_SERVER_URL || "http://localhost:5600";
}

const API_BASE = getAPIBase();

export const preconfiguredAxios = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

preconfiguredAxios.interceptors.response.use(
  (resp: AxiosResponse) => {
    const body = resp.data;
    if (body && typeof body === "object" && "success" in body) {
      if (body.success === false) throw new Error(body.message || "Request failed");
      if ("data" in body) { (resp as AxiosResponse & { _raw?: unknown })._raw = body; resp.data = body.data; }
    }
    return resp;
  },
  (err: AxiosError<{ message?: string }>) => {
    const data = err.response?.data;
    const msg = (typeof data === "object" && data?.message) || err.message || "Network error";
    const error = new Error(msg) as Error & Record<string, unknown>;
    if (data && typeof data === "object") Object.assign(error, data);
    return Promise.reject(error);
  }
);

export async function preconfiguredAxiosFunction<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  const res = await preconfiguredAxios.request<T>(config);
  return res.data as T;
}
