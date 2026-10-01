import { ImageResponse } from 'next/og';
import { EMPLOYEES } from '@/components/veqiro/data';
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const employee = EMPLOYEES.find((e) => e.key === slug);

  return new ImageResponse(
    renderOgCard({
      eyebrow: 'Veqiro AI employee',
      title: employee ? employee.name : 'Veqiro',
      subtitle: employee?.role.replace(/\n/g, ' '),
      accent: employee?.color ?? '#F5C518',
    }),
    { ...OG_SIZE },
  );
}
