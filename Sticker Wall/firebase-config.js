// Paste the config object from Firebase Console → Project settings → Your apps → SDK setup.
// This is safe to commit publicly — access control is enforced by firestore.rules / storage.rules,
// not by keeping this object secret.
export const firebaseConfig = {
  apiKey: "AIzaSyA75zWnweZ8b_4BqfW001PUVZvTjHdr-lk",
  authDomain: "sticker-paintings.firebaseapp.com",
  projectId: "sticker-paintings",
  storageBucket: "sticker-paintings.firebasestorage.app",
  messagingSenderId: "192291337891",
  appId: "1:192291337891:web:857fdf6e9574d03571b116",
};

// The one author account, created manually in Firebase Console → Authentication → Add user.
// The password entered in the UI is checked against THIS account's real password —
// the email is just a fixed identifier, never shown to the user.
export const AUTHOR_EMAIL = "sara.syed194@gmail.com";
