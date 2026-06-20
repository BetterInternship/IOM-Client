"use client";
import { useMutation } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

export async function resolveFile(kind: string, id: string): Promise<string | null> {
  try {
    const res = await preconfiguredAxios.post("/api/files/resolve", { kind, id });
    return res.data?.url ?? null;
  } catch {
    return null;
  }
}

export function useResolveFile() {
  return useMutation({
    mutationFn: ({ kind, id }: { kind: string; id: string }) => resolveFile(kind, id),
  });
}
