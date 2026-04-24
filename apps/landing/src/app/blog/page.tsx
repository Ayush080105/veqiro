import type { Metadata } from 'next';
import { getAllPostMetas } from '@/lib/blog';
import { buildPageMetadata, SITE_URL } from '@/lib/seo';
import { BlogIndexPage } from '@/components/veqiro/blog-index-page';
import { JsonLd } from '@/components/veqiro/json-ld';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = buildPageMetadata({
  title: 'Blog — AI Employees, Founders & the Future of Work',
  description:
    'Guides, how-tos, and founder playbooks on AI employees, startup operations, SEO, legal, and finance from the Veqiro team.',
  path: '/blog',
  keywords: [
    'ai employees blog',
    'founder resources',
    'startup ai guides',
    'how to build ai team',
    'ai agents for startups',
  ],
});

export default async function BlogPage() {
  const posts = await getAllPostMetas();
  const featured = posts.find((p) => p.featured) ?? posts[0];
  const grid = posts.filter((p) => p.slug !== featured.slug);

  const crumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <BlogIndexPage featured={featured} posts={grid} />
    </>
  );
}
