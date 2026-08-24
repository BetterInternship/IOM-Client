"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSignControllerRevoke } from "@/app/api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PowerOff } from "lucide-react";

function RevokePageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-5 py-8 text-center shadow-sm sm:px-8">
        {children}
      </div>
    </main>
  );
}

export default function SignRevokeTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState("");

  const revoke = useSignControllerRevoke({
    mutation: {
      onError: (e: Error) => setError(e.message),
    },
  });

  if (revoke.isSuccess) {
    return (
      <RevokePageShell>
        <span className="bg-supportive/10 text-supportive mx-auto flex size-16 items-center justify-center rounded-full">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-gray-900">
          Auto-sign turned off
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Future MOA requests sent to you will go back to a normal signing
          email — nothing signs automatically anymore.
        </p>
      </RevokePageShell>
    );
  }

  return (
    <RevokePageShell>
      <span className="bg-warning/10 text-warning mx-auto flex size-16 items-center justify-center rounded-full">
        <PowerOff className="size-8" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-gray-900">
        Turn off auto-sign?
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        You gave standing authorisation to sign future MOAs in your name.
        Turning it off doesn't undo anything already signed — future requests
        will be sent to you as a normal signing email instead.
      </p>
      {error && (
        <p className="text-destructive mt-3 text-sm leading-6">{error}</p>
      )}
      <Button
        size="lg"
        scheme="destructive"
        className="mt-6 w-full"
        disabled={!token || revoke.isPending}
        onClick={() => {
          setError("");
          revoke.mutate({ token });
        }}
      >
        {revoke.isPending ? "Turning off…" : "Turn off auto-sign"}
      </Button>
    </RevokePageShell>
  );
}
