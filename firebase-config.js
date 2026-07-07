// Paste the config object from Firebase Console → Project settings → Your apps → SDK setup.
// This is safe to commit publicly — access control is enforced by firestore.rules,
// not by keeping this object secret.
export const firebaseConfig = {
  apiKey: "AIzaSyA75zWnweZ8b_4BqfW001PUVZvTjHdr-lk",
  authDomain: "sticker-paintings.firebaseapp.com",
  projectId: "sticker-paintings",
  storageBucket: "sticker-paintings.firebasestorage.app",
  messagingSenderId: "192291337891",
  appId: "1:192291337891:web:857fdf6e9574d03571b116",
};

// "owner/repo" — where images are read from via GitHub's public contents API.
export const GITHUB_REPO = "sararasyed/paintings";
