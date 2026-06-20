import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_IOM_SERVER_URL || "http://localhost:5600";

export const preconfiguredAxios = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

preconfiguredAxios.interceptors.response.use(
  (resp: AxiosResponse) => {
    const body = resp.data;
    if (body && typeof body === "object" && "success" in body) {
      if (body.success === false) throw new Error(body.message || "Request failed");
      if ("data" in body) { (resp as any)._raw = body; resp.data = body.data; }
    }
    return resp;
  },
  (err: AxiosError<any>) => {
    const msg = err.response?.data?.message || err.message || "Network error";
    return Promise.reject(new Error(msg));
  }
);

export async function preconfiguredAxiosFunction<T = any>(config: AxiosRequestConfig): Promise<T> {
  const res = await preconfiguredAxios.request<T>(config);
  return res.data as T;
}
