# legislink-demo

Off-season static demo of legislink.us, served from GitHub Pages.

## Build locally

    make install
    make build         # reads ../legislink-2026.db, writes ./dist/
    make serve         # http://localhost:8080
    make test

## Deploy

Manual, from your local machine (the dump never leaves it):

    make deploy        # runs build, pushes dist/ to gh-pages

Then check https://legislink.us within ~1 minute.

## DNS setup (one time)

In the domain registrar:
- Apex A records: `185.199.108.153`, `185.199.108.154`, `185.199.108.155`, `185.199.108.156`
- `www` CNAME: `<github-user>.github.io`

In the GitHub repo settings:
- Pages source: `gh-pages` branch, `/` (root)
- Custom domain: `legislink.us`
- Enforce HTTPS: enable once Pages provisions the cert (~10 minutes)

## Refreshing data for next year

    cp <next-year-dump>.db ../legislink-2026.db   # or update Makefile DUMP var
    make deploy
