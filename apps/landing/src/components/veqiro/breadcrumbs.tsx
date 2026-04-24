import { breadcrumbJsonLd } from '@/lib/jsonld';
import { FONT } from '@/components/veqiro/shared';
import { JsonLd } from '@/components/veqiro/json-ld';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const schema = breadcrumbJsonLd(items);

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
                    style={{ color: '#111' }}
                  >
                    {item.name}
                  </span>
                ) : (
                  <>
                    <a
                      href={item.url}
                      style={{
                        color: '#666',
                        textDecoration: 'none',
                      }}
                    >
                      {item.name}
                    </a>
                    <span aria-hidden="true" style={{ color: '#666' }}>
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
