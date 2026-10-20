import Link from 'next/link';
import PageIntro from '@/components/content/PageIntro';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main id="main">
      <PageIntro title="This thread leads nowhere.">
        <p>The page you asked for doesn&rsquo;t exist. <Link href="/">Return to the workbench</Link>.</p>
      </PageIntro>
    </main>
  );
}
