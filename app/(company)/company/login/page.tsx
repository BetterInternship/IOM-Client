"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/preconfig.axios";

export default function CompanyLoginPage() {
  const router = useRouter();
  const [tin, setTin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/company/login", { tin, password }),
    onSuccess: () => router.replace("/company/dashboard"),
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Company Login</h1>
        <p className="text-sm text-gray-500">Sign in with your company TIN and password.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-4">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="TIN"
            value={tin}
            onChange={(e) => setTin(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            onClick={() => login.mutate()}
            disabled={login.isPending}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p className="text-sm text-center">
          <a href="/company/register" className="text-blue-600 hover:underline">Register a new company</a>
          {" · "}
          <a href="/company/forgot-password" className="text-blue-600 hover:underline">Forgot password?</a>
        </p>
      </div>
    </div>
  );
}
