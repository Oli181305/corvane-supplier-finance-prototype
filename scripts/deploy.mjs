// Builds the single-file prototype and publishes dist/ to the gh-pages branch.
// Uses plain git plumbing (no clone, no extra checkout), so it works from any
// folder, including deeply nested ones on Windows.
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: true, ...opts }).toString().trim();
const show = (cmd) => execSync(cmd, { stdio: 'inherit', shell: true });

show('npm run build');

const dist = resolve('dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/index.html not found after build');
writeFileSync(resolve(dist, '.nojekyll'), '');

const indexFile = resolve('.git', 'deploy-index');
if (existsSync(indexFile)) rmSync(indexFile);
const env = { ...process.env, GIT_INDEX_FILE: indexFile };

// Stage dist/ into a temporary index and write it as a tree.
sh(`git --work-tree="${dist}" add -f -A .`, { env });
const tree = sh('git write-tree', { env });

// Chain onto the existing gh-pages history when there is one.
let parent = '';
try {
  sh('git fetch -q origin gh-pages');
  parent = sh('git rev-parse -q --verify FETCH_HEAD');
} catch {
  parent = '';
}
const commit = sh(`git commit-tree ${tree} ${parent ? `-p ${parent}` : ''} -m "Deploy prototype"`);
show(`git push -q origin ${commit}:refs/heads/gh-pages`);
rmSync(indexFile, { force: true });

const remote = sh('git remote get-url origin');
const m = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
if (m) console.log(`\nPublished. Site: https://${m[1].toLowerCase()}.github.io/${m[2]}/`);
else console.log('\nPublished dist/ to the gh-pages branch.');
