import { FONT, T } from '@/components/veqiro/tokens';

export default function Loading() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        background: T.bg,
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: T.ink3,
        }}
      >
        loading…
      </span>
    </div>
  );
}
