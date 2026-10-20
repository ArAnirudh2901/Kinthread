import s from './StepsChart.module.css';

// Accuracy by chain length with the site's settings (beam 4, 1 view), people given.
// 2-4 steps: held-out validation stories; 5-10 steps: held-out test stories. Source: LLM repo web/test/calib.json.
const DATA = [
  { k: 2, acc: 1.0, n: 63, set: 'val' },
  { k: 3, acc: 0.93, n: 122, set: 'val' },
  { k: 4, acc: 0.77, n: 115, set: 'val' },
  { k: 5, acc: 0.45, n: 38, set: 'test' },
  { k: 6, acc: 0.33, n: 21, set: 'test' },
  { k: 7, acc: 0.36, n: 33, set: 'test' },
  { k: 8, acc: 0.28, n: 18, set: 'test' },
  { k: 9, acc: 0.18, n: 22, set: 'test' },
  { k: 10, acc: 0.38, n: 24, set: 'test' },
];

export default function StepsChart() {
  return (
    <figure className={s.chart}>
      <table className={s.table}>
        <caption>Correct answers by number of reasoning steps</caption>
        <thead>
          <tr><th scope="col">Steps</th><th scope="col">Correct</th><th scope="col" className={s.n}>Questions</th></tr>
        </thead>
        <tbody>
          {DATA.map((d) => (
            <tr key={d.k} data-set={d.set}>
              <th scope="row">{d.k}</th>
              <td>
                <span className={s.bar} aria-hidden="true"><span style={{ transform: `scaleX(${d.acc})` }} /></span>
                <span className={s.value}>{Math.round(d.acc * 100)}%</span>
              </td>
              <td className={s.n}>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>
        Measured with the settings this site uses, with the people given rather than detected. Two to four steps:
        held-out validation stories. Five to ten: held-out test stories, where samples are small.
      </figcaption>
    </figure>
  );
}
