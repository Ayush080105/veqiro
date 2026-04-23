import { ImageResponse } from 'next/og'

// Favicon for the landing app. Echoes the nav brand mark:
// black rounded square with a cream "v", yellow offset-shadow accent.
// Next 16 picks this up via file-based metadata conventions and inserts
// <link rel="icon" href="/icon?..."> into every page's <head>.

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#F5C518',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: '#111',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#EFE7D6',
            fontSize: 22,
            fontWeight: 900,
            fontFamily: 'sans-serif',
            lineHeight: 1,
            // Offset so yellow shows only on the bottom-right, mirroring
            // the `boxShadow: '4px 4px 0 #F5C518'` on the nav brand mark.
            transform: 'translate(-1px, -1px)',
          }}
        >
          v
        </div>
      </div>
    ),
    { ...size },
  )
}
