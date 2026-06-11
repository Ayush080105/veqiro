import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';

const POSTS_DIR = path.join(process.cwd(), 'content/blog');

export type BlogCategory =
  | 'ai-employees'
  | 'founders'
  | 'agents'
  | 'use-cases'
  | 'comparisons';

export type AgentKey = 'vega' | 'scout' | 'maya' | 'sage' | 'lex' | 'rex';

export interface FaqItem {
  q: string;
  a: string;
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface BlogPostMeta {
  title: string;
  slug: string;
  date: string;
  updatedDate?: string;
  description: string;
  category: BlogCategory;
  agentKey?: AgentKey;
  keywords: string[];
  ogImage?: string;
  ogImageAlt?: string;
  readingTime: number;
  featured?: boolean;
  faq: FaqItem[];
}

export interface BlogPost extends BlogPostMeta {
  contentHtml: string;
  tocItems: TocItem[];
}

function extractTocItems(html: string): TocItem[] {
  const matches = [...html.matchAll(/<h([23])[^>]*\sid="([^"]+)"[^>]*>(.*?)<\/h[23]>/g)];
  return matches.map((m) => ({
    level: parseInt(m[1]) as 2 | 3,
    id: m[2],
    text: m[3].replace(/<[^>]+>/g, ''),
  }));
}

function parseMeta(data: Record<string, unknown>, filename: string): BlogPostMeta {
  return {
    title: String(data.title ?? ''),
    slug: String(data.slug ?? filename.replace(/\.md$/, '')),
    date: String(data.date ?? ''),
    updatedDate: data.updatedDate ? String(data.updatedDate) : undefined,
    description: String(data.description ?? ''),
    category: (data.category as BlogCategory) ?? 'founders',
    agentKey: data.agentKey ? (data.agentKey as AgentKey) : undefined,
    keywords: Array.isArray(data.keywords) ? (data.keywords as string[]) : [],
    ogImage: data.ogImage ? String(data.ogImage) : undefined,
    ogImageAlt: data.ogImageAlt ? String(data.ogImageAlt) : undefined,
    readingTime: typeof data.readingTime === 'number' ? data.readingTime : 8,
    featured: Boolean(data.featured ?? false),
    faq: Array.isArray(data.faq) ? (data.faq as FaqItem[]) : [],
  };
}

/** Returns frontmatter for all posts sorted newest-first. No HTML body. */
export async function getAllPostMetas(): Promise<BlogPostMeta[]> {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8');
    const { data } = matter(raw);
    return parseMeta(data as Record<string, unknown>, filename);
  });
  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/** Returns all slugs for generateStaticParams. */
export async function getAllSlugs(): Promise<string[]> {
  const metas = await getAllPostMetas();
  return metas.map((p) => p.slug);
}

/** Returns full post including compiled HTML and TOC. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!fs.existsSync(POSTS_DIR)) return null;
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  for (const filename of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8');
    const { data, content: markdownContent } = matter(raw);
    const meta = parseMeta(data as Record<string, unknown>, filename);
    if (meta.slug !== slug) continue;

    const processed = await remark()
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeSlug)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(markdownContent);

    const contentHtml = String(processed);
    return {
      ...meta,
      contentHtml,
      tocItems: extractTocItems(contentHtml),
    };
  }
  return null;
}

/** Returns N most recent posts excluding a given slug. */
export async function getRelatedPosts(
  excludeSlug: string,
  count = 3,
): Promise<BlogPostMeta[]> {
  const all = await getAllPostMetas();
  return all.filter((p) => p.slug !== excludeSlug).slice(0, count);
}
