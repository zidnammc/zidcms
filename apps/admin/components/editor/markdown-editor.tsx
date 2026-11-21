'use client';

import { LIMITS } from '@zidcms/core';
import { renderMarkdown } from '@zidcms/core/markdown';
import {
  Bold,
  Code,
  Columns2,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
} from 'lucide-react';
import { useDeferredValue, useMemo, useRef, useState } from 'react';

type Mode = 'write' | 'split' | 'preview';

export function MarkdownEditor({
  value,
  onChange,
  onInsertImage,
  allowExternalImages,
}: {
  value: string;
  onChange: (value: string) => void;
  onInsertImage?: () => void;
  allowExternalImages: boolean;
}) {
  const [mode, setMode] = useState<Mode>('split');
  const ref = useRef<HTMLTextAreaElement>(null);
  const deferred = useDeferredValue(value);
  const html = useMemo(
    () =>
      mode === 'write'
        ? ''
        : renderMarkdown(deferred, {
            allowExternalImages,
            resolveMedia: (id) => ({ src: `/api/media/${id}/preview`, alt: '' }),
          }),
    [deferred, mode, allowExternalImages],
  );

  const wrap = (before: string, after = before, placeholder = 'teks') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = `${value.slice(0, s)}${before}${selected}${after}${value.slice(e)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
    requestAnimationFrame(() => el.focus());
  };

  const tools = [
    { label: 'Judul bagian', icon: Heading2, run: () => linePrefix('## ') },
    { label: 'Tebal', icon: Bold, run: () => wrap('**') },
    { label: 'Miring', icon: Italic, run: () => wrap('_') },
    { label: 'Tautan', icon: LinkIcon, run: () => wrap('[', '](https://)', 'teks tautan') },
    { label: 'Kode', icon: Code, run: () => wrap('`') },
    { label: 'Daftar', icon: List, run: () => linePrefix('- ') },
    { label: 'Kutipan', icon: Quote, run: () => linePrefix('> ') },
  ];

  const over = value.length > LIMITS.BODY;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Format Markdown">
          {tools.map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={run}
              disabled={mode === 'preview'}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
          {onInsertImage && (
            <button
              type="button"
              onClick={onInsertImage}
              disabled={mode === 'preview'}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold disabled:opacity-40"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Sisipkan media
            </button>
          )}
        </div>
        <div
          className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs"
          role="tablist"
          aria-label="Mode editor"
        >
          {(
            [
              ['write', 'Tulis'],
              ['split', 'Berdampingan'],
              ['preview', 'Pratinjau'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 ${
                mode === key
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {key === 'split' && <Columns2 className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`grid ${mode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'} divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800`}
      >
        {mode !== 'preview' && (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Konten Markdown"
            spellCheck
            placeholder="Tulis konten dalam Markdown…"
            className="w-full p-4 bg-transparent font-mono text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 resize-y min-h-[460px] focus:outline-none"
          />
        )}
        {mode !== 'write' && (
          <div className="p-5 min-h-[460px] max-h-[720px] overflow-y-auto">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-3">
              Pratinjau (renderer yang sama dengan situs publik)
            </div>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: output of the sanitizing renderMarkdown() */}
            <article className="zid-prose" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-400">Markdown + GFM · HTML mentah di-escape</span>
        <span className={over ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
          {value.length.toLocaleString('id-ID')} / {LIMITS.BODY.toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  );
}
