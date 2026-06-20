"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/preconfig.axios";

export default function UniversityLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/university/login", { email, password }),
    onSuccess: () => router.replace("/university/dashboard"),
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">University Login</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-4">
          <input
            type="email"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <a href="/university/forgot-password" className="text-blue-600 hover:underline">Forgot password?</a>
        </p>
      </div>
    </div>
  );
}
