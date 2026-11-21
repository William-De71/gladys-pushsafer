# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** that sends the notifications of
Gladys as Pushsafer pushes: a Node.js service (Node 22+, ESM, no build step)
that runs in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. A send-only communication integration
(`type: "communication"`, `messaging: { receive: false }`): the private key,
the username and the look of the notifications in the `config_schema`
(administrator), the device or device group of each user in the
`contact_schema`. On top: scene triggers, a scene action and dashboard
widgets. Transport: cloud only (form POSTs to `www.pushsafer.com`).

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); timer
src/pushsafer-api.js    Pushsafer client: send, key, devices, groups, failure
                        reasons (PushsaferError), the single retry
src/config.js           configuration, per-user target (a, 52, 52|65, gs12),
                        Pushsafer fields of a push with the defaults
src/picture.js          image attached by Gladys -> data URL of the push
src/store.js            /data/state.json: month counters, API calls left,
                        low API calls state, last pushes
src/events.js           scene triggers push_not_sent (transitions), api_calls_low
src/widgets.js          account and recent dashboard widgets
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **Keys are forever**: every key users store — `config_schema` and
  `contact_schema` keys and types (`device`!), the select values (priority,
  vibration), the Configuration screen buttons, widget keys, scene triggers
  (fields, options, variables), scene actions (fields, outputs) and the
  failure reasons (`FAILURE_REASONS` in `src/pushsafer-api.js`, stored by
  scenes filtering on them). `test/structure.test.js` compares them to
  `test/fixtures/manifest.baseline.json` (0.1.0): never update the baseline to
  make a test pass without a documented migration.
- **Answers of Pushsafer**: JSON `{"status":1,…}` in HTTP 200 on success,
  `{"status":0,"error":"…"}` with its own HTTP statuses on failure (250 key,
  260 empty message, 270 device, 275 group, 280 no API calls; 400 for missing
  fields), seen on the real service on 2026-11-21. Only a push reports the API
  calls left (`available`): there is no endpoint to read them.
- **Retries**: a push is retried once, only when no answer came back
  (network error) or Cloudflare answered a 5xx (520 seen). Never after a
  timeout nor a refusal of Pushsafer. A duplicate is possible and documented.
- **Secrets**: the private key never appears in a log line, an error message,
  a scene event or a widget.
- **Scene events**: `push_not_sent` fires once per scope (the account, or a
  refused device or group) until a push goes through; `api_calls_low` once
  below the threshold, armed again above it, state kept in /data. A scene
  ACTION never fires a trigger. Flat scalar data, declared keys only.
- **Limits of the store**: 10 fields per scene action (send_push is full),
  configuration messages under 200 characters (the code clips the username
  and the lists of devices and groups).
- **Widgets never call Pushsafer**: they read what the integration knows.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. A field older cores do not know needs a higher `gladys_version`
  minimum (see `src/constants.js` of the integration-store): a widget button
  with a form would need 5.2.0. Transport: `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake Pushsafer of
  `test/helpers/fake-pushsafer.js`).
