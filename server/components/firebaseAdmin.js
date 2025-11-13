import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_ISSUER_BASE = "https://securetoken.google.com";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export const verifyFirebaseIdToken = async (idToken) => {
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

  if (!firebaseProjectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured.");
  }

  const issuer = `${FIREBASE_ISSUER_BASE}/${firebaseProjectId}`;

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: firebaseProjectId,
  });

  const uid = payload.user_id || payload.sub;
  if (!uid) {
    throw new Error("Firebase token missing uid.");
  }

  return {
    uid,
    email: payload.email,
    name: payload.name,
    firebase: payload.firebase || {},
  };
};
