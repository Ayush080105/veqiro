import { breadcrumbJsonLd } from '@/lib/jsonld';
import { FONT } from '@/components/veqiro/shared';
import { JsonLd } from '@/components/veqiro/json-ld';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  theme?: 'light' | 'dark';
}

export function Breadcrumbs({ items, theme = 'light' }: BreadcrumbsProps) {
  const schema = breadcrumbJsonLd(items);
  const isDark = theme === 'dark';
  const activeColor = isDark ? '#EFE7D6' : '#111';
  const mutedColor = isDark ? '#888' : '#666';

  return (
    <>
      <JsonLd data={schema} />
      <nav
        aria-label="Breadcrumb"
        style={{ padding: '16px 0' }}
      >
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0 4px',
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li
                key={item.url}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {isLast ? (
                  <span
                    aria-current="page"
                    style={{ color: activeColor }}
                  >
                    {item.name}
                  </span>
                ) : (
                  <>
                    <a
                      href={item.url}
                      style={{
                        color: mutedColor,
                        textDecoration: 'none',
                      }}
                    >
                      {item.name}
                    </a>
                    <span aria-hidden="true" style={{ color: mutedColor }}>
                      {' / '}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
