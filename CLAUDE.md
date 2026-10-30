# Wedding invites (invite.tettesthub.in) — notes for Claude

Owner: Mukesh Dahiya. Reply in short, plain Hindi/English as the user writes.
This repo holds ONLY wedding invitation pages for clients. All new invitation work goes here,
never in the TETTESTHUB repo (Mock-test) or Exam Hub.

## How it works
- Plain static HTML. GitHub Pages, custom domain `invite.tettesthub.in` (file `CNAME`).
  DNS: CNAME `invite` -> saymukeshofficework-hash.github.io at GoDaddy.
- Push to `main` runs `.github/workflows/deploy.yml`, which copies the site files into `_site`.
- Each invitation = one folder at the root, e.g. `durgesh-sanjana-vivah-video/` -> 
  https://invite.tettesthub.in/durgesh-sanjana-vivah-video/
- New folder: also add it to the `cp -r ...` line in the workflow (it copies `durgesh-*`;
  for other names add the folder explicitly).

## Rules
- Every page has `<meta name="robots" content="noindex,nofollow,noarchive">`. No sitemap.
  Only people with the link should find it.
- Keep og:title / og:description / og:image (absolute https://invite.tettesthub.in/... URL)
  so WhatsApp shows a preview.
- To make a new format, copy an existing folder to a new name; never edit a page the client
  has already shared unless asked.
- Keep videos web-sized (H.264, CRF ~25, `-movflags +faststart`, under ~15 MB).
- The old Mukesh Dahiya education site is kept in branch `backup-mukesh-site`; don't delete it.
