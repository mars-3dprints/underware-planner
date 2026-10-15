// commit-msg hook: keeps the changelog, README and README screenshot in step with the code.
//  - feat, fix and perf commits must stage CHANGELOG.md (SKIP_CHANGELOG_CHECK=1 to skip). README.md only gets a reminder.
//  - A version bump needs a fresh docs/screenshot.png when UI files changed since the last bump
//    (SKIP_SCREENSHOT_CHECK=1 to skip, for changes that aren't visible).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

const message = readFileSync(process.argv[2], 'utf8').split('\n')[0];
const staged = lines(git('diff', '--cached', '--name-only'));
const fail = (text) => {
  console.error(`\ncommit-msg check: ${text}\n`);
  process.exit(1);
};

if (/^(feat|fix|perf)(\(.+\))?!?:/.test(message)) {
  if (!staged.includes('CHANGELOG.md') && !process.env.SKIP_CHANGELOG_CHECK) {
    fail(
      'user-facing commit without a CHANGELOG.md entry. Add a line under [Unreleased] and stage it,\n' +
        'or commit with SKIP_CHANGELOG_CHECK=1 if users will not notice the change.',
    );
  }
  if (!staged.includes('README.md')) {
    console.warn('commit-msg check: README.md is not staged. Update it if this changes what it describes.');
  }
}

if (/^chore: bump version to /.test(message) && !process.env.SKIP_SCREENSHOT_CHECK) {
  const lastBump = git('log', '--grep=^chore: bump version to', '-n', '1', '--format=%H');
  const range = lastBump ? [`${lastBump}..HEAD`] : ['HEAD'];
  const changed = lines(git('diff', '--name-only', ...range)).concat(staged);
  const visual = changed.filter((f) => /^src\/.*\.(tsx|css)$/.test(f) && !/\.test\./.test(f));
  if (visual.length && !changed.includes('docs/screenshot.png')) {
    fail(
      `UI files changed since the last version bump but docs/screenshot.png was not updated:\n  ${[...new Set(visual)].slice(0, 8).join('\n  ')}\n` +
        'Retake the README screenshot first, or bump with SKIP_SCREENSHOT_CHECK=1 if nothing visual changed.',
    );
  }
}
