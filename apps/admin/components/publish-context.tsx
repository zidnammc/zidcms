'use client';

import type { PublishJob } from '@zidcms/core';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { useToast } from './feedback';

interface PublishState {
  activeJob: PublishJob | null;
  lastJob: PublishJob | null;
  pendingChanges: boolean;
  starting: boolean;
  startPublish: () => Promise<void>;
  startRollback: (version: number) => Promise<void>;
  track: (job: PublishJob | null | undefined) => void;
  markPending: () => void;
}

const Ctx = createContext<PublishState | null>(null);

export function usePublish(): PublishState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePublish outside provider');
  return ctx;
}

const POLL_MS = 3000;
const isTerminal = (job: PublishJob) => job.state === 'live' || job.state === 'failed';

export function PublishProvider({
  initialActive,
  initialPending,
  children,
}: {
  initialActive: PublishJob | null;
  initialPending: boolean;
  children: React.ReactNode;
}) {
  const [activeJob, setActiveJob] = useState<PublishJob | null>(initialActive);
  const [lastJob, setLastJob] = useState<PublishJob | null>(null);
  const [pendingChanges, setPending] = useState(initialPending);
  const [starting, setStarting] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => setPending(initialPending), [initialPending]);

  const track = useCallback((job: PublishJob | null | undefined) => {
    if (!job) return;
    if (isTerminal(job)) setLastJob(job);
    else setActiveJob(job);
  }, []);

  const activeId = activeJob?.id ?? null;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const result = await api<{ job: PublishJob; followUp: PublishJob | null; warnings: string[] }>(
          'GET',
          `/api/publish/${activeId}`,
        );
        if (cancelled) return;
        for (const w of result.warnings ?? []) toast('warning', 'Peringatan publikasi', w);
        if (isTerminal(result.job)) {
          setLastJob(result.job);
          if (result.job.state === 'live') {
            toast('success', `Situs tayang: snapshot v${result.job.snapshot_version}`, result.job.deploy_detail);
            setPending(false);
          } else {
            toast('error', `Publikasi gagal (${result.job.error_code})`, result.job.error_message ?? undefined);
          }
          setActiveJob(result.followUp);
          router.refresh();
          return;
        }
        setActiveJob(result.job);
      } catch (err) {
        if (!cancelled) toast('warning', 'Gagal memeriksa status publikasi', errorMessage(err));
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeId, toast, router]);

  const begin = useCallback(
    async (url: string, body: Record<string, unknown>, label: string) => {
      setStarting(true);
      try {
        const result = await api<{ job: PublishJob; coalesced: boolean }>('POST', url, {
          ...body,
          idempotency_key: crypto.randomUUID(),
        });
        toast(
          'info',
          result.coalesced ? 'Digabungkan ke job yang sedang berjalan' : label,
          `Job ${result.job.id.slice(0, 8)}`,
        );
        track(result.job);
      } catch (err) {
        toast('error', 'Tidak dapat memulai publikasi', errorMessage(err));
      } finally {
        setStarting(false);
      }
    },
    [toast, track],
  );

  return (
    <Ctx.Provider
      value={{
        activeJob,
        lastJob,
        pendingChanges,
        starting,
        startPublish: () => begin('/api/publish', {}, 'Publikasi dimulai'),
        startRollback: (version) =>
          begin('/api/publish/rollback', { target_version: version }, `Rollback ke v${version} dimulai`),
        track,
        markPending: () => setPending(true),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
