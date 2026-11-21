import { AdminShell } from '@/components/admin-shell';
import { ToastProvider } from '@/components/feedback';
import { PublishProvider } from '@/components/publish-context';
import { getAdmin, getSummary, hasPendingChanges } from '@/lib/data';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  const [summary, pending] = await Promise.all([getSummary(), hasPendingChanges()]);
  return (
    <ToastProvider>
      <PublishProvider initialActive={summary.activeJob} initialPending={pending}>
        <AdminShell
          info={{
            email: admin.email,
            environment: env.environment(),
            publicSiteUrl: env.publicSiteUrl(),
            liveVersion: summary.live?.version ?? null,
            counts: { posts: summary.posts.counts.all, pages: summary.pages.counts.all, media: summary.mediaCount },
          }}
        >
          {children}
        </AdminShell>
      </PublishProvider>
    </ToastProvider>
  );
}
