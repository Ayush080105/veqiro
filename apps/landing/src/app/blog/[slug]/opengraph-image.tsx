import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/blog';
import { CATEGORY_LABELS } from '@/lib/blog-categories';
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Custom per-post images set via frontmatter (BlogPostMeta.ogImage) live in public/.
// This colocated file-convention route takes precedence over any `openGraph.images`
// set by generateMetadata (Next.js resolves file-based metadata first), so a custom
// image has to be served from here directly or it would silently never be used.
const EXT_CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (post?.ogImage) {
    const ext = post.ogImage.slice(post.ogImage.lastIndexOf('.')).toLowerCase();
    const data = await readFile(join(process.cwd(), 'public', post.ogImage.replace(/^\//, '')));
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': EXT_CONTENT_TYPE[ext] ?? 'image/png' },
    });
  }

  return new ImageResponse(
    renderOgCard({
      eyebrow: post ? (CATEGORY_LABELS[post.category] ?? post.category) : 'Veqiro blog',
      title: post?.title ?? 'Veqiro',
      subtitle: post?.description,
      accent: '#6FCDE8',
    }),
    { ...OG_SIZE },
  );
}
