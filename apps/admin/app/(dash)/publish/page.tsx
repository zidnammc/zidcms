import type { PublishJob, SnapshotRecord } from '@zidcms/core';
import { PublishScreen } from '@/components/publish-screen';
import { getAdmin } from '@/lib/data';
import { env } from '@/lib/env';
import { gas } from '@/lib/gas-client';

export const metadata = { title: 'Publikasi' };

export default async function PublishPage() {
  const admin = await getAdmin();
  const ctx = { actor: admin.email };
  const [jobs, snapshots] = await Promise.all([
    gas<{ items: PublishJob[] }>('publish.listJobs', { limit: 20 }, ctx),
    gas<{ items: SnapshotRecord[] }>('snapshots.list', { limit: 30 }, ctx),
  ]);
  const commitUrlBase = env.publishTarget() === 'github' ? `https://github.com/${env.githubRepo()}/commit` : null;
  return <PublishScreen jobs={jobs.items} snapshots={snapshots.items} commitUrlBase={commitUrlBase} />;
}
