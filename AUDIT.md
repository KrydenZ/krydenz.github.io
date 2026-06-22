# Project Audit (Internal)

This file records technical audit findings and maintenance decisions for repository maintainers. It is not intended to be part of the public blog content.

## 2026-03 Full Technical Check (re-run)

### Commands executed
- `node -v && npm -v && ruby -v && jekyll -v`
- `npm install`
- `npm install --legacy-peer-deps`
- `npm audit --json`
- `npx grunt --version && npx grunt less --verbose`
- `npx grunt default`

### Findings
1. **Jekyll CLI missing in runtime**
   - `jekyll -v` failed (`command not found`), so local site build cannot run directly in this environment.
2. **Dependency tree conflict with modern npm defaults**
   - `npm install` fails with `ERESOLVE` due to `grunt@1.x` and old `grunt-contrib-less@0.11.4` peer constraints.
3. **Security debt in legacy Grunt toolchain**
   - `npm audit` reports 24 vulnerabilities (18 high, 3 critical), mostly transitive through old `grunt-contrib-less`/`request` stack.
4. **Build config mismatch was present and fixed**
   - `Gruntfile.js` previously pointed at `pkg.name` (`krydenz.github.io`) for JS/LESS filenames, but repo assets are `hux-blog.*`; this caused "no source files were found" during LESS task.
   - Updated Grunt config to use `assetName: 'hux-blog'` consistently.
5. **Repository hygiene improvement**
   - Added `node_modules/` to `.gitignore` to avoid accidental dependency tree commits.

### Current status after fixes in this run
- `npx grunt default` now succeeds and compiles/updates expected artifacts (`css/hux-blog.css`, `css/hux-blog.min.css`, `js/hux-blog.min.js`).
- Tooling security upgrades remain a follow-up task (likely requires major-version dependency updates).

## 2026-06 CI/CD and Asset Toolchain Update

### Commands executed
- `npm ci`
- `npm run build:assets`
- `bundle exec jekyll build --strict_front_matter`
- `npm audit --audit-level=moderate`
- `git diff --check -- css/hux-blog.css css/hux-blog.min.css js/hux-blog.min.js`

### Maintenance decisions
1. **Replaced Travis CI with GitHub Actions**
   - Removed `.travis.yml` and the unused `codecov.yml`.
   - Added a GitHub Actions Pages workflow that builds assets, builds Jekyll, checks committed generated assets, audits Node dependencies, uploads `_site`, and deploys through GitHub Pages.
2. **Removed the legacy Grunt asset pipeline**
   - Removed `Gruntfile.js` and Grunt-related npm dependencies.
   - Added `scripts/build-assets.js`, which uses `less`, `lightningcss`, and `terser` to generate the same committed asset outputs.
3. **Resolved npm audit findings**
   - The Grunt dependency tree was the source of the remaining moderate/high npm audit findings.
   - The replacement toolchain currently reports `found 0 vulnerabilities`.
4. **Locked Node dependencies**
   - Added `package-lock.json` so CI can use `npm ci`.
5. **Line ending behavior**
   - Asset generation writes LF output and the workflow checks generated assets for whitespace issues.

### Current status after this run
- `npm run build:assets` succeeds.
- `bundle exec jekyll build --strict_front_matter` succeeds.
- `npm audit --audit-level=moderate` succeeds with zero vulnerabilities.
- Re-running the asset build is idempotent for committed generated assets.

## Site Exposure Policy
- `AUDIT.md` is an internal document and should not be published as a site page.
- It is excluded from Jekyll output via the `exclude` setting.
