// Guest tracking: the phone typed into the track form is kept per tab, never put in the URL.
/** Phone numbers typed into the track form, kept for this tab only (never in the URL). */
export function rememberTrackingPhone(number: string, phone: string) {
  try {
    sessionStorage.setItem(`detty-track:${number}`, phone);
  } catch {
    /* private mode — the customer just re-enters it */
  }
}
export function trackingPhone(number: string) {
  try {
    return sessionStorage.getItem(`detty-track:${number}`) ?? undefined;
  } catch {
    return undefined;
  }
}
