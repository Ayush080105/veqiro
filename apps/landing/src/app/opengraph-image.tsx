import { ImageResponse } from 'next/og';
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-image';

export const alt = "Veqiro: AI employees for lean teams";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    renderOgCard({
      eyebrow: 'AI employees for lean teams',
      title: 'Veqiro',
      subtitle: 'Six AI employees. One shared brain. No headcount.',
      accent: '#F5C518',
    }),
    { ...OG_SIZE },
  );
}
