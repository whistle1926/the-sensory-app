# Dependency freeze — ask before installing anything

**Active from 5 Aug 2026, until Paddy lifts it.**

Do NOT install, add, update or upgrade any package without Paddy's explicit
approval in the conversation first. This covers `npm install`, `npm update`,
`npm i -g`, `npx <package>` where the package is not already in
`node_modules/`, and adding a dependency to `package.json` by hand.

Allowed without asking: running binaries already installed in this repo
(`npx tsc`, `npx next`, `npx prisma`, `npx tsx`, `npm run <script>`) and
`vercel`, since those resolve to versions already on disk.

If a task genuinely needs a new package, stop and ask. Say what the package is,
why it's needed, and wait for a yes.

**Why:** a self-propagating supply-chain worm ("Shai-Hulud") has been spreading
through npm, stealing credentials and writing malicious hooks into the files
coding agents read at session start. Installing a routine update to a package
you have used for years is enough to get caught. The freeze stays until the
attack is contained.

Related: never write secrets into tracked files, and treat any unexpected
change to `.claude/` settings, `CLAUDE.md`, `AGENTS.md`, or hook config as
suspicious rather than routine.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
