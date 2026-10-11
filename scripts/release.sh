#!/usr/bin/env bash
# Publishes a GitHub Release (and tag) for every version in CHANGELOG.md that doesn't have one yet.
# The tag goes on the commit that first set package.json to that version, and the release notes are
# that version's changelog section. Versions without such a commit are skipped with a warning.
#
# Needs: full git history, the gh CLI with GH_TOKEN. DRY_RUN=1 prints what it would do instead.
# In GitHub Actions it writes `released=true|false` and `tag=<latest release>` to $GITHUB_OUTPUT.
set -euo pipefail

# Prints the body of the `## [version]` section, without surrounding blank lines.
notes_for() {
  awk -v heading="## [$1]" '
    index($0, heading) == 1 { on = 1; next }
    on && /^## \[/ { exit }
    on { lines[++n] = $0 }
    END {
      first = 1; while (first <= n && lines[first] ~ /^[[:space:]]*$/) first++
      last = n; while (last >= first && lines[last] ~ /^[[:space:]]*$/) last--
      for (i = first; i <= last; i++) print lines[i]
    }
  ' CHANGELOG.md
}

existing=$(gh release list --limit 1000 --json tagName --jq '.[].tagName')

# Oldest first, so the newest version ends up marked as the latest release.
versions=$(grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | tr -d '#[] ' | sort -V)

for version in $versions; do
  tag="v$version"
  if grep -qxF "$tag" <<<"$existing"; then
    echo "$tag: release exists, skipping"
    continue
  fi
  # Read all of git log's output: `| head -n 1` can kill it with SIGPIPE, which fails the script under pipefail.
  commits=$(git log --reverse --format=%H -S"\"version\": \"$version\"" -- package.json)
  commit=${commits%%$'\n'*}
  if [[ -z "$commit" ]]; then
    echo "::warning::$tag: no commit sets package.json to $version, skipping"
    continue
  fi
  if [[ -n "${DRY_RUN:-}" ]]; then
    echo "$tag: would release at ${commit:0:7} ($(git log -1 --format=%s "$commit"))"
    notes_for "$version" | sed 's/^/    /'
    continue
  fi
  notes_for "$version" | gh release create "$tag" --target "$commit" --title "$tag" --notes-file -
  echo "$tag: released at ${commit:0:7}"
  released=true
done

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "released=${released:-false}" >>"$GITHUB_OUTPUT"
  if [[ -n "${released:-}" ]]; then
    echo "tag=$(gh release view --json tagName --jq .tagName)" >>"$GITHUB_OUTPUT"
  fi
fi
