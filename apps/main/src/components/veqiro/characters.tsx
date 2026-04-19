'use client';

const GrainFilter = () => (
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
    <feComposite in2="SourceGraphic" operator="in" />
  </filter>
);

interface GradProps { id: string; from: string; to: string; }
const SoftGradient = ({ id, from, to }: GradProps) => (
  <radialGradient id={id} cx="30%" cy="25%" r="100%">
    <stop offset="0%" stopColor={from} />
    <stop offset="100%" stopColor={to} />
  </radialGradient>
);

interface AvatarProps { size?: number | string; }

export function Vega({ size = 300 }: AvatarProps) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs><SoftGradient id="vega-bg" from="#BDEAF7" to="#6FCDE8" /><GrainFilter /></defs>
      <rect width="300" height="300" fill="url(#vega-bg)" />
      <rect width="300" height="300" fill="url(#vega-bg)" filter="url(#grain)" opacity="0.5" />
      <g stroke="#111" strokeWidth="3" fill="#6FCDE8">
        <circle cx="90" cy="95" r="28" /><circle cx="130" cy="70" r="32" />
        <circle cx="175" cy="70" r="30" /><circle cx="215" cy="95" r="28" />
        <circle cx="75" cy="140" r="22" /><circle cx="225" cy="145" r="22" />
        <circle cx="110" cy="115" r="25" /><circle cx="195" cy="115" r="25" />
      </g>
      <ellipse cx="150" cy="155" rx="52" ry="60" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <g fill="#111">
        <path d="M130 150 q5 -8 10 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M160 150 q5 -8 10 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="122" cy="170" r="6" fill="#F79FD4" opacity="0.6" />
      <circle cx="178" cy="170" r="6" fill="#F79FD4" opacity="0.6" />
      <path d="M135 178 q15 14 30 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M100 215 Q150 200 200 215 L220 300 L80 300 Z" fill="#111" stroke="#111" strokeWidth="3" />
      <path d="M110 230 L110 300 M125 230 L125 300 M140 230 L140 300 M155 230 L155 300 M170 230 L170 300 M185 230 L185 300"
        stroke="#EFE7D6" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

export function Scout({ size = 300 }: AvatarProps) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs><SoftGradient id="scout-bg" from="#FFE37A" to="#F5C518" /><GrainFilter /></defs>
      <rect width="300" height="300" fill="url(#scout-bg)" />
      <rect width="300" height="300" fill="url(#scout-bg)" filter="url(#grain)" opacity="0.5" />
      <path d="M80 110 Q100 40 180 55 Q240 65 225 120 Q215 90 180 85 Q140 80 120 110 Z" fill="#F5C518" stroke="#111" strokeWidth="3" />
      <path d="M180 60 Q200 50 220 70" stroke="#111" strokeWidth="3" fill="none" />
      <ellipse cx="155" cy="150" rx="55" ry="62" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <ellipse cx="170" cy="148" rx="5" ry="3" fill="#111" />
      <path d="M140 147 l8 0" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      <path d="M165 138 q8 -4 14 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M158 180 q12 6 22 -2" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M195 155 q8 10 -2 18" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M95 215 Q155 205 215 215 L225 300 L85 300 Z" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <g stroke="#111" strokeWidth="1.5" opacity="0.8">
        <path d="M100 230 L225 230 M100 250 L225 250 M100 270 L225 270" />
        <path d="M120 215 L120 300 M150 215 L150 300 M180 215 L180 300 M210 215 L210 300" />
      </g>
      <path d="M135 215 L155 240 L175 215" fill="#111" stroke="#111" strokeWidth="3" />
    </svg>
  );
}

export function Maya({ size = 300 }: AvatarProps) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs><SoftGradient id="maya-bg" from="#FFB3B3" to="#F06464" /><GrainFilter /></defs>
      <rect width="300" height="300" fill="url(#maya-bg)" />
      <rect width="300" height="300" fill="url(#maya-bg)" filter="url(#grain)" opacity="0.5" />
      <path d="M190 90 Q260 80 245 150 Q235 200 210 220 Q225 170 215 130 Q205 100 190 95 Z" fill="#F06464" stroke="#111" strokeWidth="3" />
      <path d="M90 120 Q90 60 160 55 Q220 55 220 115 Q215 90 190 88 Q170 88 160 100 Q140 90 115 100 Q100 115 95 135 Z" fill="#F06464" stroke="#111" strokeWidth="3" />
      <ellipse cx="145" cy="155" rx="52" ry="62" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <path d="M128 148 q6 -5 12 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M160 148 q6 -5 12 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="120" cy="175" r="8" fill="#F06464" opacity="0.55" />
      <circle cx="175" cy="175" r="8" fill="#F06464" opacity="0.55" />
      <path d="M135 185 q12 8 24 0 q-12 4 -24 0 Z" fill="#D23A3A" stroke="#111" strokeWidth="2" />
      <circle cx="195" cy="170" r="4" fill="#111" />
      <path d="M95 215 Q145 205 195 215 L210 300 L80 300 Z" fill="#B32D2D" stroke="#111" strokeWidth="3" />
      <path d="M115 215 Q145 225 175 215" stroke="#111" strokeWidth="3" fill="none" />
    </svg>
  );
}

export function Sage({ size = 300 }: AvatarProps) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs><SoftGradient id="sage-bg" from="#FFD1EC" to="#F79FD4" /><GrainFilter /></defs>
      <rect width="300" height="300" fill="url(#sage-bg)" />
      <rect width="300" height="300" fill="url(#sage-bg)" filter="url(#grain)" opacity="0.5" />
      <ellipse cx="130" cy="70" rx="40" ry="30" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <path d="M100 95 Q150 70 195 95 L190 130 Q150 115 105 130 Z" fill="#F79FD4" stroke="#111" strokeWidth="3" />
      <path d="M195 90 L215 80 L205 100 L220 105 L200 110 Z" fill="#F79FD4" stroke="#111" strokeWidth="3" />
      <g fill="#FFF1E0">
        <circle cx="120" cy="108" r="3" /><circle cx="145" cy="100" r="3" />
        <circle cx="170" cy="108" r="3" /><circle cx="135" cy="118" r="3" /><circle cx="160" cy="118" r="3" />
      </g>
      <ellipse cx="150" cy="160" rx="52" ry="60" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <g fill="none" stroke="#E56AB5" strokeWidth="5">
        <rect x="110" y="140" width="32" height="28" rx="6" />
        <rect x="158" y="140" width="32" height="28" rx="6" />
        <path d="M142 154 L158 154" />
      </g>
      <circle cx="126" cy="154" r="3" fill="#111" />
      <circle cx="174" cy="154" r="3" fill="#111" />
      <path d="M135 185 q15 12 30 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M100 220 Q150 210 200 220 L215 300 L85 300 Z" fill="#F79FD4" stroke="#111" strokeWidth="3" />
      <g stroke="#FFF1E0" strokeWidth="2" opacity="0.8">
        <path d="M105 235 L215 235 M105 250 L215 250 M105 265 L215 265 M105 280 L215 280" />
      </g>
    </svg>
  );
}

export function Lex({ size = 300 }: AvatarProps) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs><SoftGradient id="lex-bg" from="#B3B3F7" to="#8A8AF0" /><GrainFilter /></defs>
      <rect width="300" height="300" fill="url(#lex-bg)" />
      <rect width="300" height="300" fill="url(#lex-bg)" filter="url(#grain)" opacity="0.5" />
      <path d="M95 115 Q95 50 160 50 Q220 55 215 110 Q205 85 175 80 Q150 78 135 88 Q115 95 102 115 Z" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <ellipse cx="150" cy="155" rx="52" ry="60" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <g fill="none" stroke="#111" strokeWidth="3">
        <circle cx="128" cy="148" r="14" />
        <circle cx="172" cy="148" r="14" />
        <path d="M142 148 L158 148" />
      </g>
      <circle cx="128" cy="148" r="2.5" fill="#111" />
      <circle cx="172" cy="148" r="2.5" fill="#111" />
      <path d="M130 182 q10 -4 20 0 q10 -4 20 0 q-5 8 -20 7 q-15 1 -20 -7 Z" fill="#3D3DB0" stroke="#111" strokeWidth="2" />
      <path d="M140 196 q10 3 20 0" stroke="#111" strokeWidth="2" fill="none" />
      <path d="M100 220 Q150 205 200 220 L215 300 L85 300 Z" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <path d="M135 225 L155 238 L135 250 Z" fill="#2A2A7A" stroke="#111" strokeWidth="2" />
      <path d="M175 225 L155 238 L175 250 Z" fill="#2A2A7A" stroke="#111" strokeWidth="2" />
      <rect x="151" y="232" width="8" height="12" fill="#2A2A7A" stroke="#111" strokeWidth="2" />
    </svg>
  );
}

export function Rex({ size = 300 }: AvatarProps) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs><SoftGradient id="rex-bg" from="#9AE8CC" to="#1DBC87" /><GrainFilter /></defs>
      <rect width="300" height="300" fill="url(#rex-bg)" />
      <rect width="300" height="300" fill="url(#rex-bg)" filter="url(#grain)" opacity="0.5" />
      <path d="M95 105 Q95 50 160 50 Q225 55 220 115 L210 120 Q200 95 170 90 Q140 90 125 105 Q110 115 100 120 Z" fill="#0E5C3F" stroke="#111" strokeWidth="3" />
      <g stroke="#1DBC87" strokeWidth="2" fill="none">
        <path d="M115 80 q8 -8 15 0 q8 -8 15 0 q8 -8 15 0" />
        <path d="M120 95 q8 -6 15 0 q8 -6 15 0 q8 -6 15 0" />
      </g>
      <ellipse cx="155" cy="160" rx="52" ry="60" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <g fill="none" stroke="#111" strokeWidth="3">
        <rect x="117" y="140" width="28" height="22" rx="2" />
        <rect x="160" y="140" width="28" height="22" rx="2" />
        <path d="M145 151 L160 151" />
      </g>
      <circle cx="131" cy="151" r="2.5" fill="#111" />
      <circle cx="174" cy="151" r="2.5" fill="#111" />
      <path d="M155 172 q4 6 0 10" stroke="#111" strokeWidth="2" fill="none" />
      <path d="M138 190 q17 8 34 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M95 220 Q155 210 215 220 L225 300 L85 300 Z" fill="#1DBC87" stroke="#111" strokeWidth="3" />
      <path d="M125 220 L155 250 L185 220" fill="#FFF1E0" stroke="#111" strokeWidth="3" />
      <path d="M150 245 L160 245 L163 295 L147 295 Z" fill="#0E5C3F" stroke="#111" strokeWidth="2" />
    </svg>
  );
}

export const CHARACTER_COMPONENTS: Record<string, React.ComponentType<AvatarProps>> = {
  vega: Vega, scout: Scout, maya: Maya, sage: Sage, lex: Lex, rex: Rex,
};
