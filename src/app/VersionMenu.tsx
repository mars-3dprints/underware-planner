import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '../ui/useDismiss';
import { IS_RELEASE, NEW_ISSUE_URL, RELEASE_NOTES_URL, REPO_URL, VERSION_LABEL } from './about';

const external = { target: '_blank', rel: 'noreferrer' } as const;

/** Version label next to the app name, with a popover of release notes, source and bug-report links. */
export function VersionMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <span className="popwrap" ref={ref}>
      <button
        className={'version' + (open ? ' on' : '')}
        title="About this version"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {VERSION_LABEL}
      </button>
      {open && (
        <div className="pop" role="dialog" aria-label="About">
          <span className="sub">Underware Planner {VERSION_LABEL}</span>
          <p className="hint">
            {IS_RELEASE
              ? 'Free and open source (MIT).'
              : 'Development build: may include changes not in any release yet.'}
          </p>
          <nav className="menulinks">
            <a href={RELEASE_NOTES_URL} {...external}>
              {IS_RELEASE ? 'Release notes' : 'All releases'}
            </a>
            <a href={REPO_URL} {...external}>
              Source on GitHub
            </a>
            <a href={NEW_ISSUE_URL} {...external}>
              Report a bug or idea
            </a>
          </nav>
        </div>
      )}
    </span>
  );
}
