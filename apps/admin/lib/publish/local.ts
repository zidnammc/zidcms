import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Snapshot, ZidError } from '@zidcms/core';
import { type CommitInput, type DeployState, jobMarker, type SnapshotStore } from './store';

interface LocalCommit {
  sha: string;
  message: string;
  at: string;
}

export class LocalStore implements SnapshotStore {
  readonly kind = 'local' as const;
  private readonly webRoot: string;
  private readonly historyDir: string;

  constructor(repoRoot: string, contentRoot = 'apps/web') {
    this.webRoot = resolve(repoRoot, contentRoot);
    this.historyDir = resolve(repoRoot, '.local/publish');
    mkdirSync(this.historyDir, { recursive: true });
  }

  private log(): LocalCommit[] {
    const file = join(this.historyDir, 'commits.json');
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as LocalCommit[]) : [];
  }

  async commit(input: CommitInput): Promise<string> {
    const body = `${JSON.stringify(input.snapshot, null, 2)}\n`;
    const sha = createHash('sha1').update(`${input.jobId}\n${body}`).digest('hex');
    const mediaDir = join(this.webRoot, 'public/media');
    mkdirSync(mediaDir, { recursive: true });
    mkdirSync(join(this.historyDir, 'media'), { recursive: true });
    mkdirSync(join(this.webRoot, 'content'), { recursive: true });
    const wanted = new Set(input.media.map((m) => m.path.replace(/^\/media\//, '')));
    for (const media of input.media) {
      const name = media.path.replace(/^\/media\//, '');
      const target = join(mediaDir, name);
      const archived = join(this.historyDir, 'media', name);
      if (!existsSync(target)) {
        const bytes = existsSync(archived) ? readFileSync(archived) : Buffer.from(await media.loadBase64(), 'base64');
        writeFileSync(target, bytes);
      }
      if (!existsSync(archived)) writeFileSync(archived, readFileSync(target));
    }
    for (const file of readdirSync(mediaDir)) {
      if (!wanted.has(file) && file !== '.gitkeep') rmSync(join(mediaDir, file));
    }
    writeFileSync(join(this.webRoot, 'content/snapshot.json'), body);
    writeFileSync(join(this.webRoot, 'public/zidcms-version.json'), `${JSON.stringify(input.versionFile)}\n`);
    writeFileSync(join(this.historyDir, `${sha}.json`), body);
    const log = this.log();
    log.unshift({ sha, message: input.message, at: new Date().toISOString() });
    writeFileSync(join(this.historyDir, 'commits.json'), JSON.stringify(log.slice(0, 200), null, 2));
    return sha;
  }

  async findCommitForJob(jobId: string): Promise<string | null> {
    return this.log().find((c) => c.message.includes(jobMarker(jobId)))?.sha ?? null;
  }

  async readSnapshot(sha: string): Promise<Snapshot> {
    const file = join(this.historyDir, `${sha}.json`);
    if (!/^[0-9a-f]{40}$/.test(sha) || !existsSync(file)) {
      throw new ZidError('NOT_FOUND', 'Snapshot lokal tidak ditemukan.');
    }
    return JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  }

  async deployStatus(): Promise<{ state: DeployState; detail: string }> {
    if (process.env.LOCAL_DEPLOY_FAIL === 'true')
      return { state: 'failure', detail: 'Simulasi build gagal (LOCAL_DEPLOY_FAIL)' };
    return { state: 'success', detail: 'Mode lokal: berkas ditulis ke apps/web' };
  }
}
