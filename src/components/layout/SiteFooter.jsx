import Link from 'next/link';
import Mark from '@/components/brand/Mark';
import { RUNTIME } from '@/lib/runtime.generated';
import s from './SiteFooter.module.css';

export const SOURCE_URL = 'https://github.com/ArAnirudh2901/LLM-From-Scratch';

export default function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={`container ${s.inner}`}>
        <div className={s.brand}>
          <Mark size={26} />
          <p>
            <strong>Kinthread</strong> runs both of its models inside your browser. Your stories are not sent to a server
            for inference.
          </p>
        </div>
        <nav aria-label="Footer" className={s.links}>
          <Link href="/limits/">Limits & tips</Link>
          <Link href="/build-log/">Build log</Link>
          <a href={SOURCE_URL} rel="noopener noreferrer">Source on GitHub</a>
        </nav>
        <p className={`mono ${s.version}`}>
          model {RUNTIME.release.releaseId} &middot; runtime {RUNTIME.runtime.split('/')[2].slice(0, 8)}
        </p>
      </div>
    </footer>
  );
}
