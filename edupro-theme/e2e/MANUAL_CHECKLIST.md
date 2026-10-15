# Manual / exploratory checklist

Things a script shouldn't be the judge of. Work through this once per pass,
using the same `*.demo@edupro.co.zw` accounts as the automated suite, and
report results back directly (per the plan's Phase C — this list isn't
run by Claude).

## Visual / design (item 1, item 10)

- [ ] Sign-in, sign-up, forgot-password, OTP screens — light mode
- [ ] Same 4 screens — dark mode
- [ ] Each role's dashboard — light and dark mode, desktop width
- [ ] Each role's dashboard — light and dark mode, mobile width (< 480px)
- [ ] Any layout that breaks, text that clips, or contrast that's hard to
      read in either theme

## Auth (item 1)

- [ ] Error copy for a wrong password reads clearly (not a raw stack trace
      or generic "something went wrong")
- [ ] If you choose to briefly re-enable 2FA on one demo account
      (`patches/enable_mfa_for_privileged_roles.py` — talk to whoever owns
      that decision first, this is a production setting): does the OTP
      email actually arrive, and does entering the code work end to end?
      Re-disable it afterward if you do this.
- [ ] Sign-up flow (if it's meant to be used) — does it actually create a
      usable account, or is it decorative like the `/otp` route?

## School setup (item 2)

- [ ] After the logo-display bug (finding #1) is fixed: does the school's
      uploaded logo look right at the small sizes it renders at (sidebar
      icon, sign-in header)? Uploads are expected roughly square — confirm
      a non-square upload doesn't look broken.
- [ ] Does the Edupro platform mark still appear appropriately (not
      replaced entirely) once a school logo is wired in — the spec asked
      for *both* to be visible on screen, only the school's on documents.

## Currency (item 3)

- [ ] Once the ZiG-vs-USD primary-currency contradiction (finding #2) is
      resolved: spot-check a handful of real dollar amounts against what a
      Bursar would expect from the source records, in both currencies.
- [ ] Does changing the exchange rate in Institution Profile actually
      change what a *different* logged-in user (e.g. School Head, in a
      separate browser/incognito) sees, or only the browser that set it?

## Everything else

- [ ] Anything that felt slow, confusing, or "off" while working through
      the automated suite's flows manually once yourself — note it even if
      it doesn't map to one of the 11 items above.
