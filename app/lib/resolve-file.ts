"use client";
import { useEffect, useState } from "react";
import { filesControllerResolve } from "@/app/api/app/api/endpoints/files/files";
import type { ResolveFileDtoKind } from "@/app/api";

const TTL_MS = 28 * 60 * 1000; // 28 min — server signs for 30, refresh 2 min early

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

const key = (kind: ResolveFileDtoKind, id: string) => `${kind}:${id}`;

export async function resolveFile(kind: ResolveFileDtoKind, id: string): Promise<string | null> {
  const k = key(kind, id);

  const cached = cache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const existing = inflight.get(k);
  if (existing) return existing;

  const promise = filesControllerResolve({ kind, id })
    .then((res) => {
      const url: string | null = res.url ?? null;
      if (url) cache.set(k, { url, expiresAt: Date.now() + TTL_MS });
      inflight.delete(k);
      return url;
    })
    .catch(() => {
      inflight.delete(k);
      return null;
    });

  inflight.set(k, promise);
  return promise;
}

export function useResolvedFile(kind: ResolveFileDtoKind, id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout>;

    const fetch = async () => {
      setLoading(true);
      const resolved = await resolveFile(kind, id);
      if (cancelled) return;
      setUrl(resolved);
      setLoading(false);

      // Schedule a proactive refresh 1 minute before the cached URL expires.
      const entry = cache.get(key(kind, id));
      if (entry) {
        const delay = entry.expiresAt - Date.now() - 60_000;
        if (delay > 0) {
          refreshTimer = setTimeout(() => {
            cache.delete(key(kind, id));
            fetch();
          }, delay);
        }
      }
    };

    fetch();
    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
    };
  }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { url, loading };
}
