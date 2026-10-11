import { version } from '../../package.json';

export const REPO_URL = 'https://github.com/mars-3dprints/underware-planner';
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;

/** True only for the deployed site: the deploy workflow builds release tags with `--mode release`. */
export const IS_RELEASE = import.meta.env.MODE === 'release';
/** `v0.4.0` for a release; `v0.4.0+dev` for any other build, which may include unreleased changes. */
export const VERSION_LABEL = `v${version}${IS_RELEASE ? '' : '+dev'}`;
export const RELEASE_NOTES_URL = IS_RELEASE ? `${REPO_URL}/releases/tag/v${version}` : `${REPO_URL}/releases`;
