'use client';
import Image from 'next/image';

interface AvatarProps { size?: number | string; }

function CharImg({ src, alt, size = 300 }: { src: string; alt: string; size?: number | string }) {
  if (size === '100%') {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', overflow: 'hidden' }}>
        <Image src={src} alt={alt} fill style={{ objectFit: 'cover', objectPosition: 'top center' }} />
      </div>
    );
  }
  const s = Number(size);
  return (
    <Image src={src} alt={alt} width={s} height={s} style={{ objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
  );
}

export function Vega({ size = 300 }: AvatarProps) {
  return <CharImg src="/Vega.jpeg" alt="Vega, Veqiro's AI Executive Assistant" size={size} />;
}
export function Scout({ size = 300 }: AvatarProps) {
  return <CharImg src="/Scout.jpeg" alt="Scout, Veqiro's AI Research & Strategist" size={size} />;
}
export function Maya({ size = 300 }: AvatarProps) {
  return <CharImg src="/Maya.jpeg" alt="Maya, Veqiro's AI Content & Marketing specialist" size={size} />;
}
export function Sage({ size = 300 }: AvatarProps) {
  return <CharImg src="/Sage.jpeg" alt="Sage, Veqiro's AI SEO Specialist" size={size} />;
}
export function Lex({ size = 300 }: AvatarProps) {
  return <CharImg src="/Lex.jpeg" alt="Lex, Veqiro's AI Legal Assistant" size={size} />;
}
export function Rex({ size = 300 }: AvatarProps) {
  return <CharImg src="/Rex.jpeg" alt="Rex, Veqiro's AI Data Analyst & Finance specialist" size={size} />;
}

export const CHARACTER_COMPONENTS: Record<string, React.ComponentType<AvatarProps>> = {
  vega: Vega, scout: Scout, maya: Maya, sage: Sage, lex: Lex, rex: Rex,
};
