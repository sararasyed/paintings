# Sticker Wall

A collage-style sticker board. You (the author) upload or paste sticker images; anyone viewing can drag stickers around. Positions are shared and persist for everyone.

## One-time setup

1. Create a Firebase project at https://console.firebase.google.com.
2. In the project, enable:
   - **Firestore Database** (start in production mode — the rules below define access).
   - **Storage**.
   - **Authentication** → Sign-in method → enable **Email/Password**.
3. Authentication → Users → **Add user**. Use any email (e.g. `you@example.com`) and a real password — this password is what the site's "password gate" actually checks. Copy the generated **User UID**.
4. In `firestore.rules` and `storage.rules`, replace `AUTHOR_UID_HERE` with that UID.
5. Project settings → General → Your apps → Add app → Web. Copy the resulting config object into `firebase-config.js`, and set `AUTHOR_EMAIL` to the email you used in step 3.
6. Install the Firebase CLI (`npm install -g firebase-tools`), then from this folder:
   ```
   firebase login
   firebase init firestore storage   # select the project you created
   firebase deploy --only firestore:rules,storage:rules
   ```

## Running locally

ES modules require `http://`, not `file://`. Serve the folder with any static server, e.g.:
```
npx serve .
```
Then open the printed local URL.

## Deploying

Push this folder to a GitHub repo, then connect it to Netlify, Vercel, or GitHub Pages as a static site — no build command needed, publish directory is the repo root.

The Firebase config in `firebase-config.js` is safe to publish; access control is enforced entirely by `firestore.rules` / `storage.rules`, not by hiding the config.

## How it works

- Unlock panel signs you into the one Firebase Auth account created in setup step 3.
- Once unlocked, "Add sticker" (file picker) or pasting an image uploads to Firebase Storage and creates a Firestore document with a random position and slight random rotation.
- Everyone can drag any sticker; the new position is saved on drag release and persists for all future visitors.
- Firestore/Storage rules enforce that only the authenticated author can create or delete stickers — a signed-out visitor's write is only ever allowed to update a sticker's `x`/`y`/`rotation`.
