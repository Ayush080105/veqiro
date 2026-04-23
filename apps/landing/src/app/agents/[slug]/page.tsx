import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EMPLOYEES } from '@/components/veqiro/data';
import { AgentPage } from '@/components/veqiro/agent-page';
import { Footer } from '@/components/veqiro/sections';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return EMPLOYEES.map(e => ({ slug: e.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const employee = EMPLOYEES.find(e => e.key === slug);
  if (!employee) return {};
  return {
    title: `${employee.name} — ${employee.role} | Veqiro`,
    description: employee.description,
    openGraph: {
      title: `Meet ${employee.name}, your AI ${employee.role}`,
      description: employee.description,
    },
  };
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
