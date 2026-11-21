'use client';

import type { ContentKind } from '@zidcms/core';
import { Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { btn, useToast } from './feedback';

export function RestoreButton({ kind, id, version }: { kind: ContentKind; id: string; version: number }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const restore = async () => {
    setBusy(true);
    try {
      await api('POST', `/api/${kind}s/${id}/restore`, { expected_version: version });
      toast('success', 'Dipulihkan sebagai draf');
      router.refresh();
    } catch (err) {
      toast('error', 'Gagal memulihkan', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={restore} disabled={busy} className={btn.ghost}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
      Pulihkan
    </button>
  );
}
