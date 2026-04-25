import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EMPLOYEES } from '@/components/veqiro/data';
import { AgentPage } from '@/components/veqiro/agent-page';
import { Footer } from '@/components/veqiro/sections';
import { buildPageMetadata, AGENT_META } from '@/lib/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return EMPLOYEES.map(e => ({ slug: e.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const employee = EMPLOYEES.find(e => e.key === slug);
  const agentMeta = AGENT_META[slug];
  if (!employee || !agentMeta) return {};
  return buildPageMetadata({
    title: `${employee.name} — ${agentMeta.seoTitleSuffix}`,
    description: agentMeta.metaDescription,
    path: `/agents/${slug}`,
    ogImage: `/og/${slug}.png`,
    ogImageAlt: `${employee.name}, Veqiro's AI ${employee.role}`,
    keywords: agentMeta.keywords,
  });
}

export default async function AgentSlugPage({ params }: Props) {
  const { slug } = await params;
  const employee = EMPLOYEES.find(e => e.key === slug);
  if (!employee) notFound();

  return (
    <>
      <AgentPage employee={employee} />
      <Footer />
    </>
  );
}
