import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllSlugs, getPostBySlug, getRelatedPosts } from '@/lib/blog';
import { buildPageMetadata, SITE_URL } from '@/lib/seo';
import { BlogPostLayout } from '@/components/veqiro/blog-post-layout';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  // No ogImage/ogImageAlt here: this route has a colocated opengraph-image.tsx,
  // and Next.js's file-based metadata always takes precedence over an explicit
  // openGraph.images set here, so passing one would be silently ignored. A custom
  // per-post image (post.ogImage) is served directly by that file instead.
  return buildPageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
    keywords: post.keywords,
    type: 'article',
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, 3);

  const crumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${slug}` },
  ];

  return <BlogPostLayout post={post} related={related} crumbs={crumbs} />;
}
