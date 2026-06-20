"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

type Step = "details" | "otp";

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    tin: "",
    legalIdentifier: "",
    repEmail: "",
    password: "",
    displayName: "",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const register = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/company/register", form),
    onSuccess: (res) => {
      setResendIn(res.data?.resendIn ?? 60);
      setStep("otp");
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const verify = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/auth/company/otp/verify", { repEmail: form.repEmail, code }),
    onSuccess: () => {
      router.replace("/company/dashboard");
    },
    onError: (e: any) => setError(e.message),
  });

  const resend = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/company/otp/request", { repEmail: form.repEmail }),
    onSuccess: (res) => {
      setResendIn(res.data?.resendIn ?? 60);
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Verify your email</h1>
            <p className="text-sm text-gray-500 mt-1">
              We sent a code to <span className="font-medium">{form.repEmail}</span>. Enter it below.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input
            className="w-full border rounded px-3 py-2 text-sm tracking-widest text-center text-lg"
            placeholder="6-digit code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            onClick={() => verify.mutate()}
            disabled={code.length < 6 || verify.isPending}
          >
            {verify.isPending ? "Verifying…" : "Verify & Continue"}
          </button>
          <button
            className="w-full text-sm text-gray-500 hover:underline disabled:opacity-40"
            onClick={() => resend.mutate()}
            disabled={resendIn > 0 || resend.isPending}
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Register your company</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your TIN will be verified with BIR ORUS.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Company TIN</label>
            <input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="000-000-000-000" {...field("tin")} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Legal identifier (BIR-registered name or SEC/DTI number)</label>
            <input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="Acme Corporation" {...field("legalIdentifier")} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Display name</label>
            <input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="Acme Corp" {...field("displayName")} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Representative email</label>
            <input type="email" className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="rep@acme.com" {...field("repEmail")} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Password (min 8 characters)</label>
            <input type="password" className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="••••••••" {...field("password")} />
          </div>
          <button
            className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2"
            onClick={() => register.mutate()}
            disabled={register.isPending}
          >
            {register.isPending ? "Verifying with BIR…" : "Continue"}
          </button>
        </div>
        <p className="text-sm text-center">
          Already registered?{" "}
          <a href="/company/login" className="text-blue-600 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
