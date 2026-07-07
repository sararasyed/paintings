# Sticker Wall

A collage-style sticker board. Add images by dropping them into the `stickers/` folder and pushing — the site auto-detects them. Anyone viewing can drag stickers around; positions are shared and persist for everyone.

## One-time setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Enable **Firestore Database** (production mode — the rules below define access).
3. Project settings → General → Your apps → Add app → Web. Copy the resulting config object into `firebase-config.js`, and set `GITHUB_REPO` to your `owner/repo` string.
4. In the Firebase Console, go to Firestore Database → **Rules** tab, paste in the contents of `firestore.rules`, and publish.

## Adding stickers

Drop an image file (`.png`, `.jpg`, `.gif`, `.webp`, or `.svg`) into the `stickers/` folder and push to GitHub. The next time anyone loads the page, it's discovered automatically via GitHub's public API and given a random starting position. To remove one, delete its file from `stickers/` and push — it'll stop appearing (its old position record is just left behind, harmlessly).

## Running locally

ES modules require `http://`, not `file://`. Serve the folder with any static server, e.g.:
```
npx serve .
```
Then open the printed local URL. Note this still talks to the real GitHub repo and Firestore project — there's no local-only mode.

## Deploying

Push this folder to a GitHub repo, then connect it to Netlify, Vercel, or GitHub Pages as a static site — no build command needed, publish directory is the repo root.

The Firebase config in `firebase-config.js` is safe to publish; access control is enforced entirely by `firestore.rules`, not by hiding the config.

## How it works

- On page load, the site calls GitHub's public contents API to list files in `stickers/`.
- For each image not yet seen, it creates a Firestore record with a random position; for ones already seen, it reuses the saved position.
- Everyone can drag any sticker; the new position is saved on drag release and persists for all future visitors.
- Firestore rules only allow position-field updates and well-shaped creates — nothing lets a visitor delete a record or tamper with other fields.
