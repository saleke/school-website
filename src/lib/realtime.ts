"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";

type RealtimeEvent = {
  type: "insert" | "update" | "delete";
  table: string;
  record: Record<string, unknown>;
};

export function useRealtimeSubscription(
  table: string,
  filter: string,
  onEvent: (event: RealtimeEvent) => void,
) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;

    function connect() {
      if (cancelled) return;
      try {
        const channel = `${table}-${filter}-${Date.now()}`;
        // Supabase Realtime via REST polling fallback
        // In production, use supabase-js realtime channel
        const poll = async () => {
          if (cancelled) return;
          try {
            const rows = await supabaseRequest<Record<string, unknown>[]>(
              `${table}?${filter}&select=*&order=created_at.desc&limit=1`,
            );
            if (!cancelled && rows?.length) {
              setConnected(true);
              onEventRef.current({ type: "insert", table, record: rows[0] });
            }
          } catch {
            // Silent fail for polling
          }
          if (!cancelled) {
            retryTimeout = setTimeout(poll, 10000);
          }
        };
        poll();
      } catch {
        retryCount++;
        if (!cancelled && retryCount < 5) {
          retryTimeout = setTimeout(connect, 5000 * retryCount);
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
    };
  }, [table, filter]);

  return { connected };
}

// Simple in-memory cache for frequently accessed data
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds

export async function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

export function invalidateCache(key: string) {
  cache.delete(key);
}

export function clearCache() {
  cache.clear();
}
