"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

export default function UniversityForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const forgot = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/university/forgot", { email }),
    onSuccess: () => { setSent(true); setError(""); },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reset password</h1>
        {sent ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            If an account with that email exists, a reset link has been sent.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500">Enter your account email to receive a reset link.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              type="email"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              onClick={() => forgot.mutate()}
              disabled={!email || forgot.isPending}
            >
              {forgot.isPending ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-sm text-center">
          <a href="/university/login" className="text-blue-600 hover:underline">Back to login</a>
        </p>
      </div>
    </div>
  );
}
