// Uploads the files pinned in model.lock.json to a GitHub Release, so a fresh clone can download the model.
// Needs the LLM repo (KINSHIP_SRC) and gh signed in as the repo owner. Owner-only; run after a model change.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.resolve(process.env.KINSHIP_SRC || path.join(root, '../../Generative_AI/LLM_from_Scratch/2_Training_Tiny_LLM'));
const lock = JSON.parse(readFileSync(path.join(root, 'model.lock.json'), 'utf8'));
const files = Object.keys(lock.files).map((f) => path.join(src, 'web', f));
const gh = (...args) => execFileSync('gh', args, { stdio: 'inherit' });

gh('release', 'create', lock.release, '--repo', 'ArAnirudh2901/Kinthread', '--title', `Model ${lock.release}`,
  '--notes', 'Runtime and model files for Kinthread. `npm run sync` downloads and checks these automatically (see model.lock.json).',
  ...files);
