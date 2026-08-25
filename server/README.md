# Living Gradients — panel service

The three endpoints `js/service.js` talks to, as one Cloudflare Worker.

```
GET  /version    is there a newer build
GET  /messages   notices to show in the panel's bell
POST /feedback   a report from a user, forwarded and archived
POST /admin/*    write the version record and post messages (bearer token)
GET  /admin/feedback   read the archive
```

Free tier covers this several times over — it is a version record and a handful
of announcements.

## Try it before you deploy

The whole thing runs locally, with a simulated KV namespace, no Cloudflare
account and no network:

```bash
cd server
npm install
npx wrangler dev --local --var ADMIN_TOKEN:testtoken
```

Then in another terminal:

```bash
curl http://127.0.0.1:8787/version
curl -X POST http://127.0.0.1:8787/admin/version -H "Authorization: Bearer testtoken" -H "Content-Type: application/json" -d '{"version":"2.2.0","notes":"Preset capture."}'
curl http://127.0.0.1:8787/version
```

To point the panel at it, change `API` at the top of `js/service.js` to
`http://127.0.0.1:8787` and reload the panel. The bell lights up with the
update. Change it back before building a release — `tools/build.ps1` warns if
it is still on the placeholder host, but it cannot tell a local URL from a real
one.

Note the local KV state persists in `server/.wrangler/`, so a version you set
while testing is still there next time you run it. Delete that folder to start
clean.

## Deploy

```bash
cd server
npm install
npx wrangler login          # opens your browser; only you can do this
npx wrangler kv namespace create LG_KV
```

Paste the printed id into `wrangler.jsonc`, then:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put FEEDBACK_WEBHOOK
npx wrangler deploy
```

`FEEDBACK_WEBHOOK` is where reports land — a Discord or Slack incoming webhook,
or an automation endpoint. Make it somewhere you actually look: the value of the
feedback button is entirely in the reading. Every report is archived to KV as
well, so a broken webhook is a nuisance rather than data loss.

Finally, point the panel at it — `API` at the top of `js/service.js`:

```js
var API = 'https://living-gradients-api.<your-subdomain>.workers.dev';
```

Until you do, every call fails quietly and the panel behaves exactly as it does
without a backend.

## Announcing a release

```bash
curl -X POST https://your-worker/admin/version \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":"2.2.0","url":"https://digivero.gumroad.com/l/livinggradients","notes":"Preset capture, collections, and a proper data folder."}'
```

Panels pick it up within twelve hours, or immediately on **Check for updates**.

## Posting a message

```bash
curl -X POST https://your-worker/admin/message \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New gradient pack","body":"Six new metals are in 2.2.","url":"https://...","kind":"news"}'
```

`expires` hides it after a date. `onlyPanel` aims it at one build — "2.0.0 had a
bug, here is what to do" should not reach anyone already on 2.0.1. Posting with
an existing `id` replaces that message rather than duplicating it, which is how
a typo in an announcement gets fixed.

## What the panel sends

The version and message checks send the panel version and nothing else. Feedback
sends what the user typed plus the context block shown to them in the dialog
before they send it: panel version, After Effects version and language, platform,
whether file writing is enabled, preset count, and the last JavaScript error.

No project data, no layer names, no identifiers, no counting. Users can turn the
version and message checks off in Settings. If that ever changes it changes in
`js/service.js`, visibly.
