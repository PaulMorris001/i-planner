import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  getAdditionalUserInfo,
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  updateProfile,
  type AuthCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/config/firebase";
import { authEmailService } from "@/services/authEmail.service";
import { mapFirebaseError, mapFirebaseUser } from "@/services/auth.service";
import { getDeviceInfo } from "@/utils/deviceId";
import { clearPendingReferralCode, savePendingReferralCode } from "@/utils/referralPending";
import type { AuthError } from "@/types/auth.types";
import type { User } from "@/types/user.types";

export type SocialProvider = "apple" | "google";

export interface SocialSignInResult {
  user: User;
  // True the first time this Apple/Google account signs in, i.e. an account was just created.
  isNewUser: boolean;
}

// What a provider's own sign-in sheet hands back: the Firebase credential to sign in with.
interface ProviderCredential {
  credential: AuthCredential;
  // Apple only, and only the first time it is shown: the person's name.
  fullName?: string;
  // Apple only: needed to revoke Apple's tokens when the account is deleted.
  authorizationCode?: string;
}

const APPLE_PROVIDER_ID = "apple.com";
const GOOGLE_PROVIDER_ID = "google.com";

// ---- Apple ----------------------------------------------------------------------------------

// Apple signs the nonce into its token; Firebase checks the token against the RAW value, so Apple
// is given the hash and Firebase the original. This is what stops a stolen token being replayed.
async function requestAppleCredential(): Promise<ProviderCredential | null> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const apple = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!apple.identityToken) throw new Error("Apple did not return a sign-in token.");

    const fullName = [apple.fullName?.givenName, apple.fullName?.familyName].filter(Boolean).join(" ");
    return {
      credential: new OAuthProvider(APPLE_PROVIDER_ID).credential({ idToken: apple.identityToken, rawNonce }),
      fullName: fullName || undefined,
      authorizationCode: apple.authorizationCode ?? undefined,
    };
  } catch (err) {
    if ((err as { code?: string })?.code === "ERR_REQUEST_CANCELED") return null;
    throw err;
  }
}

// ---- Google ---------------------------------------------------------------------------------

let googleConfigured = false;

function configureGoogleOnce() {
  if (googleConfigured) return;
  // The WEB client id is what makes Google return an id token Firebase accepts. The iOS and
  // Android clients are read from GoogleService-Info.plist / google-services.json.
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

async function requestGoogleCredential(): Promise<ProviderCredential | null> {
  configureGoogleOnce();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    const idToken = response.data.idToken;
    if (!idToken) throw new Error("Google did not return a sign-in token.");
    return { credential: GoogleAuthProvider.credential(idToken) };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw err;
  }
}

function requestCredential(provider: SocialProvider): Promise<ProviderCredential | null> {
  return provider === "apple" ? requestAppleCredential() : requestGoogleCredential();
}

// ---- Errors ---------------------------------------------------------------------------------

function mapSocialError(err: unknown, provider: SocialProvider): AuthError {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/account-exists-with-different-credential") {
    return {
      message: "An account with this email already exists. Sign in with your email and password instead.",
      field: "general",
    };
  }
  if (code.startsWith("auth/")) return mapFirebaseError(err);
  const name = provider === "apple" ? "Apple" : "Google";
  console.error(`[socialAuth] ${name} sign-in failed`, err);
  return { message: `Couldn't sign in with ${name}. Please try again.`, field: "general" };
}

// ---- Public API -----------------------------------------------------------------------------

export const socialAuthService = {
  // Which social provider (if any) this account signs in with. Email and password accounts: null.
  providerOf(user: FirebaseUser): SocialProvider | null {
    const ids = user.providerData.map((p) => p.providerId);
    if (ids.includes(APPLE_PROVIDER_ID)) return "apple";
    if (ids.includes(GOOGLE_PROVIDER_ID)) return "google";
    return null;
  },

  // Opens the provider's sign-in sheet and signs in (creating the account the first time).
  // Resolves to null when the person closed the sheet, which is not an error.
  async signIn(provider: SocialProvider, options?: { referralCode?: string }): Promise<SocialSignInResult | null> {
    let obtained: ProviderCredential | null;
    try {
      obtained = await requestCredential(provider);
    } catch (err) {
      throw mapSocialError(err, provider);
    }
    if (!obtained) return null;

    // Remembered BEFORE the account exists, exactly like email sign-up: the referral loader runs
    // the moment the account appears and has to find the code waiting.
    const referralCode = options?.referralCode?.trim();
    if (referralCode) await savePendingReferralCode(referralCode);

    try {
      const result = await signInWithCredential(auth, obtained.credential);
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
      // A code only ever applies to a brand-new account.
      if (referralCode && !isNewUser) await clearPendingReferralCode();

      // Apple shows the name once, and only to the app: keep it on the new account.
      if (isNewUser && obtained.fullName && !result.user.displayName) {
        await updateProfile(result.user, { displayName: obtained.fullName });
      }

      const displayName = result.user.displayName ?? undefined;
      // Not awaited: an email problem must never fail a sign-in that worked.
      getDeviceInfo()
        .then((device) =>
          isNewUser ? authEmailService.sendWelcome(displayName, device) : authEmailService.sendLoginNotify(displayName, device)
        )
        .catch((err) => console.error("[socialAuth] failed to send account email", err));

      return { user: mapFirebaseUser(result.user), isNewUser };
    } catch (err) {
      if (referralCode) await clearPendingReferralCode();
      throw mapSocialError(err, provider);
    }
  },

  // Asks the person to confirm with their provider again, for actions Firebase wants a recent
  // sign-in for (deleting the account). Resolves to null when they closed the sheet.
  async reauthenticate(user: FirebaseUser, provider: SocialProvider): Promise<{ authorizationCode?: string } | null> {
    let obtained: ProviderCredential | null;
    try {
      obtained = await requestCredential(provider);
    } catch (err) {
      throw mapSocialError(err, provider);
    }
    if (!obtained) return null;
    try {
      await reauthenticateWithCredential(user, obtained.credential);
    } catch (err) {
      throw mapSocialError(err, provider);
    }
    return { authorizationCode: obtained.authorizationCode };
  },
};
