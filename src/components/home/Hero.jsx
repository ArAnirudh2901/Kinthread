import Constellation from '@/components/three/Constellation';
import HeroActions from './HeroActions';
import s from './Hero.module.css';

const WORDS = ['Find', 'the', 'thread', 'that', 'connects', 'them.'];

// Server-rendered text (the CSS word reveal paints without JavaScript); the 3D scene loads after.
export default function Hero() {
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <Constellation variant="hero" className={s.scene} />
      <div className={`container ${s.inner}`}>
        <div className={s.text}>
          <h1 id="hero-title" className={`display ${s.title}`}>
            {WORDS.map((w, i) => (
              <span key={w} className={s.word} style={{ '--i': i }}>
                {w === 'thread' ? <em>{w}</em> : w}{i < WORDS.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <p className={s.lede}>Blood-relation puzzles, solved step by step. Give Kinthread a family story and watch it trace how two people are related, with a from-scratch AI that runs on your device.</p>
          <HeroActions />
        </div>
      </div>
    </section>
  );
}
