# Contributing to the Final POE

Use normal Git development history so the repository demonstrates genuine collaboration.

- Create focused branches for meaningful features/fixes.
- Make small, descriptive commits such as `feat: add offline alert replay` or `test: cover evidence service configuration`.
- Pull/rebase before merging and resolve conflicts deliberately.
- Run `node scripts/verify-submission.mjs`, `node scripts/check-no-secrets.mjs` and relevant Android/server tests before pushing.
- Never commit `.env`, `local.properties`, service-account JSON, SAS URLs, tokens, keystores or generated signed packages.
- Use pull requests/reviews where practical so multiple contributors are visible.
- Do not manufacture commits solely to inflate the rubric count; preserve real engineering work.
