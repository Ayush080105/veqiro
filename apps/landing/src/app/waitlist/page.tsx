import { buildPageMetadata } from '@/lib/seo';
import { serverUrl, maxWaitlistSlots } from '@/lib/site-config';
import WaitlistPageContent from '@/components/veqiro/waitlist-page-content';

export const metadata = buildPageMetadata({
  title: 'Join the Waitlist — Veqiro',
  description: 'Veqiro launches soon. Join the waitlist and get 30% off your first month as a founding member.',
  path: '/waitlist',
});

async function getWaitlistCount(): Promise<number> {
  try {
    const res = await fetch(`${serverUrl}/waitlist/count`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const data = (await res.json()) as { count: number };
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function WaitlistPage() {
  const count = await getWaitlistCount();
  return <WaitlistPageContent count={count} max={maxWaitlistSlots} />;
}
