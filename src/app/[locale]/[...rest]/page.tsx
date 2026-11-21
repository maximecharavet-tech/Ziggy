import { notFound } from 'next/navigation';

/**
 * Any URL that matches no page (e.g. /une-page-perdue, /en/lost-page): the
 * localized 404 of src/app/[locale]/not-found.tsx, inside the site layout, with
 * a 404 status. Real pages and next.config redirects always win over this
 * catch-all; it used to fall through to the root not-found, which sent every
 * unknown URL to the home page.
 *
 * The page itself sits inside the [locale]/loading.tsx Suspense boundary, whose
 * shell is sent (status 200) before the page renders. Metadata is resolved
 * before that shell, so notFound() is thrown there first: the answer is a real
 * 404. Rendered on demand as a static page (nothing built ahead), so repeat
 * visits of the same unknown URL come from the cache.
 */
export const dynamicParams = true;

export function generateStaticParams(): { rest: string[] }[] {
  return [];
}

export async function generateMetadata(): Promise<never> {
  notFound();
}

export default function UnknownPage() {
  notFound();
}
