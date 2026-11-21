import type { Element, ElementContent, Root as HastRoot } from 'hast';
import type { Root as MdastRoot } from 'mdast';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface RenderOptions {
  resolveMedia?: (id: string) => { src: string; alt: string } | null;
  allowExternalImages?: boolean;
  siteUrl?: string;
}

const BLOCKED_SCHEME = /^\s*(javascript|data|vbscript):/i;

function remarkEscapeHtml() {
  return (tree: MdastRoot) => {
    visit(tree, 'html', (node, index, parent) => {
      if (!parent || index === undefined) return;
      parent.children[index] = { type: 'text', value: node.value } as never;
    });
  };
}

function textNode(value: string): ElementContent {
  return { type: 'text', value };
}

function rehypeImages(options: RenderOptions) {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'img' || !parent || index === undefined) return;
      const src = String(node.properties.src ?? '');
      const alt = String(node.properties.alt ?? '');
      if (src.startsWith('zid-media:')) {
        const resolved = options.resolveMedia?.(src.slice('zid-media:'.length).toLowerCase());
        if (resolved) {
          node.properties.src = resolved.src;
          node.properties.alt = alt || resolved.alt;
        } else {
          parent.children[index] = {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: [textNode(`[gambar tidak tersedia${alt ? `: ${alt}` : ''}]`)],
          };
        }
        return;
      }
      if (src.startsWith('/media/')) {
        node.properties.loading = 'lazy';
        return;
      }
      if (/^https:\/\//i.test(src)) {
        if (options.allowExternalImages) {
          node.properties.loading = 'lazy';
          node.properties.referrerPolicy = 'no-referrer';
          return;
        }
        parent.children[index] = {
          type: 'element',
          tagName: 'a',
          properties: { href: src },
          children: [textNode(alt || src)],
        };
        return;
      }
      parent.children[index] = textNode(alt ? `[${alt}]` : '');
    });
  };
}

function rehypeLinks(options: RenderOptions) {
  const site = options.siteUrl?.replace(/\/+$/, '').toLowerCase() ?? '';
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties.href ?? '');
      if (BLOCKED_SCHEME.test(href)) {
        delete node.properties.href;
        return;
      }
      if (/^https?:\/\//i.test(href) && !(site && href.toLowerCase().startsWith(site))) {
        node.properties.rel = ['noopener', 'noreferrer'];
      }
    });
  };
}

const schema = {
  ...defaultSchema,
  clobberPrefix: '',
  clobber: [],
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['https'],
  },
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'referrerPolicy'],
  },
};

export function renderMarkdown(markdown: string, options: RenderOptions = {}): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkEscapeHtml)
    .use(remarkRehype)
    .use(rehypeImages, options)
    .use(rehypeSanitize, schema)
    .use(rehypeSlug)
    .use(rehypeLinks, options)
    .use(rehypeStringify)
    .processSync(markdown);
  return String(file);
}
