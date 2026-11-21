import type { MediaMime } from '../limits';

export type ContentStatus = 'draft' | 'published' | 'archived';
export type ContentKind = 'post' | 'page';
export type TaxonomyKind = 'category' | 'tag';

interface ContentBase {
  id: string;
  title: string;
  slug: string;
  content_markdown: string;
  status: ContentStatus;
  seo_title: string;
  seo_description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  published_at: string | null;
  deleted_at: string | null;
  version: number;
}

export interface Post extends ContentBase {
  excerpt: string;
  author_name: string;
  category_id: string | null;
  tag_ids: string[];
  cover_media_id: string | null;
}

export interface Page extends ContentBase {
  nav_order: number | null;
}

export type ContentItem = Post | Page;
export type ContentSummary<T extends ContentItem = ContentItem> = Omit<T, 'content_markdown'>;

export interface Taxon {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface Media {
  id: string;
  drive_file_id: string;
  filename: string;
  mime_type: MediaMime;
  size_bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  alt_text: string;
  created_at: string;
  created_by: string;
  deleted_at: string | null;
  version: number;
}

export interface SiteSettings {
  site_title: string;
  site_description: string;
  site_language: string;
  posts_per_page: number;
  default_author_name: string;
  social_image_media_id: string | null;
  footer_text: string;
  allow_external_images: boolean;
}

export interface Revision {
  id: string;
  content_type: ContentKind;
  content_id: string;
  version: number;
  title: string;
  content_markdown: string;
  meta_json: string;
  created_at: string;
  created_by: string;
}

export type RevisionSummary = Omit<Revision, 'content_markdown' | 'meta_json'>;

export const PUBLISH_JOB_STATES = [
  'queued',
  'collecting',
  'committing',
  'deploying',
  'verifying',
  'live',
  'failed',
] as const;
export type PublishJobState = (typeof PUBLISH_JOB_STATES)[number];
export type PublishJobType = 'publish' | 'rollback';

export interface PublishJob {
  id: string;
  type: PublishJobType;
  idempotency_key: string;
  requested_by: string;
  state: PublishJobState;
  target_version: number | null;
  snapshot_version: number | null;
  checksum: string | null;
  rerun_requested: boolean;
  lease_expires_at: string;
  step_lease_until: string | null;
  step_attempts: number;
  git_commit_sha: string | null;
  deploy_detail: string;
  state_entered_at: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

export type SnapshotStatus = 'committed' | 'live' | 'failed' | 'superseded';

export interface SnapshotRecord {
  version: number;
  checksum: string;
  git_commit_sha: string;
  item_count: number;
  media_count: number;
  status: SnapshotStatus;
  source_job_id: string;
  based_on_version: number | null;
  created_at: string;
  created_by: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id: string;
  result: string;
  detail: string;
}

export function isPost(item: ContentItem): item is Post {
  return 'author_name' in item;
}
