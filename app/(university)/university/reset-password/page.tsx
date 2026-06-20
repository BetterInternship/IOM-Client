"use client";
import { useState, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

function UniversityResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const reset = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/university/reset", { token, password }),
    onSuccess: () => { setDone(true); setError(""); },
    onError: (e: any) => setError(e.message),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 text-sm text-red-600">Invalid reset link.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Set new password</h1>
        {done ? (
          <>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
              Password reset successfully.
            </p>
            <button
              className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
              onClick={() => router.push("/university/login")}
            >
              Go to login
            </button>
          </>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              type="password"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="New password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-red-500">Passwords do not match.</p>
            )}
            <button
              className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              onClick={() => reset.mutate()}
              disabled={password.length < 8 || password !== confirm || reset.isPending}
            >
              {reset.isPending ? "Resetting…" : "Reset password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function UniversityResetPasswordPage() {
  return (
    <Suspense>
      <UniversityResetPasswordForm />
    </Suspense>
  );
}
