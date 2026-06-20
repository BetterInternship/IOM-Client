"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/preconfig.axios";

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const accept = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/university/accept-invite", { token, password }),
    onSuccess: () => router.replace("/university/dashboard"),
    onError: (e: any) => setError(e.message),
  });

  const submit = () => {
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    accept.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Set your password</h1>
        <p className="text-sm text-gray-500">Choose a password to activate your university account.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-4">
          <input type="password" className="w-full border rounded px-3 py-2 text-sm" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" className="w-full border rounded px-3 py-2 text-sm" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50" onClick={submit} disabled={accept.isPending}>
            {accept.isPending ? "Activating…" : "Activate account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return <Suspense><AcceptInviteForm /></Suspense>;
}
