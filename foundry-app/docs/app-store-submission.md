# App Store submission checklist

Everything App Store Connect needs that isn't in the build. Kept next to the
code so it stays honest as the app changes.

> **The App Privacy answers below must match `ios/App/App/PrivacyInfo.xcprivacy`
> exactly.** Apple cross-checks them, and a mismatch gets flagged. If you change
> one, change the other in the same commit.

---

## 1. App Privacy — the nutrition label

App Store Connect → your app → **App Privacy** → Edit.

This questionnaire is **web-UI only**; the App Store Connect API doesn't expose
it, so it can't be scripted.

### First question: "Do you or your third-party partners collect data from this app?"

**Yes.**

### Then declare exactly these eight types

For every one: **not** used for tracking, and the only purpose is
**App Functionality**. Nothing here is used for advertising, analytics,
personalisation, or product personalisation.

| Apple category | Data type | Linked to identity? | What it actually is |
|---|---|---|---|
| Contact Info | **Email Address** | Yes | Account sign-in |
| Contact Info | **Name** | Yes | First name from onboarding; shown to training partners |
| Identifiers | **User ID** | Yes | Supabase account id |
| Health & Fitness | **Health** | Yes | Body weight, incl. Apple Health read/write |
| Health & Fitness | **Fitness** | Yes | The training log — workouts, sets, reps, loads |
| User Content | **Other User Content** | Yes | Session and exercise notes |
| Diagnostics | **Crash Data** | **No** | Sentry, anonymised |
| Other Data | **Other Data Types** | Yes | Date of birth (asked at account creation) and gender |

Crash Data is the only one **not** linked to identity — Sentry gets no account
identifier. **This became true on 2026-09-20:** the app used to call
`Sentry.setUser({ email, id })` and ran performance tracing (undeclared
"Performance Data"). Both are gone — errors only, no `setUser`. If either ever
comes back, this table and `PrivacyInfo.xcprivacy` must change with it.
Everything else is stored against the user's account by design.

**Third-party AI (guideline 5.1.2(i)).** The optional coach sends program inputs
(goal, experience, split, schedule, equipment, the lifter's free-text coach
note, recent top lifts) to Anthropic's Claude via our Cloudflare Worker. Name,
gender, email and account id are NOT sent (pinned by
`src/utils/__tests__/api.privacy.test.ts`). The app shows a one-time consent
sheet before the first send (`CoachConsentSheet`), and declining builds the same
program without the coach. If App Store Connect asks about third-party AI
sharing: **yes, with consent, for App Functionality only.**

### Tracking

When asked whether data is used to track: **No**, for every type. The app has no
advertising identifiers, no third-party analytics SDKs, and no data-broker
relationships. `NSPrivacyTracking` is `false` in the manifest.

---

## 2. Demo account for App Review

The app is behind a login, so Apple **requires** working credentials. Missing
them is one of the most common first-rejection causes.

App Store Connect → **App Review Information** → tick *Sign-in required*.

```
Username:  demo@thefoundry.coach
Password:  FoundryDemo2026!
```

Verified working against the live Supabase project: created through the normal
signup endpoint, email auto-confirmed, password grant returns a session. There
is no email-confirmation wall for the reviewer.

### What's in the account

Seeded so a reviewer lands in a working app rather than onboarding. Verified
readable through RLS as the account itself:

- Profile "Alex" — intermediate, build muscle, 4 days/week, full-body split
- An active 6-week full-body mesocycle started 2026-08-03, 4 training days,
  20 exercises
- **Two complete weeks** — 8 finished sessions, 120 logged sets, with real
  week-over-week progression, and readiness scores attached
- Volume ramps MEV → MAV across the two weeks (50 sets then 70), so the
  periodization is visible rather than flat
- A five-point body weight trend
- Day 4 includes **Inverted Row**, a bodyweight movement logged with reps and
  no load — useful for seeing that progression works on movements that carry
  no weight

**Keep it current: run `scripts/demo/redate-demo-account.sql` (Supabase SQL
editor or MCP) right before every submission, and again if review stalls.**
Once the last session is 7+ days old, a reviewer lands on the "welcome back
after a break" sheet instead of the app. The script shifts every dated row for
the demo user forward by whole weeks (weekdays stay aligned) as far as it can
without dating anything in the future, and is safe to re-run. Last run
2026-09-18: meso starts 2026-09-07, weeks 1–2 complete, week 3 starts Monday.

### Notes for the reviewer

Paste something like this into the Notes field:

> The Foundry generates multi-week strength training programs. Sign in with the
> credentials above.
>
> The demo account already has an active 6-week program with logged history, so
> progression and history views are populated.
>
> Apple Health is optional and off by default. To review it: Settings → Apple
> Health → toggle on. iOS shows one permission sheet covering body weight and
> workouts. Completing a workout with the workout permission granted writes a
> Traditional Strength Training entry to Apple Fitness and contributes active
> energy to the Move ring. Declining either permission leaves the rest of the
> app fully functional.
>
> The AI coach is optional. Before its first use the app explains that it runs
> on Anthropic's Claude, lists what is sent, and asks for agreement; "Build
> without the coach" produces a full program with nothing sent.
>
> Privacy Policy and Support are linked from Settings, and the Privacy Policy
> from every Create Account screen.
>
> Account deletion is in Settings → Account → Delete Account.

---

## 3. URLs

| Field | Value |
|---|---|
| Privacy Policy URL | `https://thefoundry.coach/privacy` |
| Support URL | `https://thefoundry.coach/support` |
| Marketing URL | `https://thefoundry.coach` (optional) |

**Use the extensionless URLs.** Cloudflare Pages 308-redirects `/privacy.html`
→ `/privacy`, so the `.html` forms work but hand Apple a redirect for no reason.

Apple requires the support URL to be a real page — a `mailto:` link is rejected.
Both are live and returning 200 as of 2026-08-16.

---

## 4. Still outstanding

- **Screenshots.** Required for 6.9" iPhone. **iPad 13" is also required**
  because `TARGETED_DEVICE_FAMILY = "1,2"` — see below.
- **Description, keywords, category, subtitle, promotional text.** Suggested
  primary category: Health & Fitness.
- **Age rating questionnaire.** The privacy policy states the app isn't intended
  for under-13s; the rating must not contradict that.
- **Export compliance.** Already answered in-plist —
  `ITSAppUsesNonExemptEncryption = false`.

### iPad decision

The build declares universal support and all four iPad orientations. That
obligates iPad screenshots *and* a layout that survives rotation on a 13" iPad.
Every layout in the app is phone-first.

Either commit to the iPad audit (branch `2.15.0-ipad`) or set
`TARGETED_DEVICE_FAMILY = 1` and drop
`UISupportedInterfaceOrientations~ipad`. TestFlight doesn't care either way;
App Store submission does.

---

## 5. Row-level security — fixed 2026-08-16

Found while seeding the demo account: a brand-new account with no friends and no
shared programs could read every `user_profiles` row (name, gender, date of
birth, body weight), every `mesocycles` row, every `mesocycle_members` row, and
every live join code. Training data was always correctly locked.

Closed by migrations **010** (SECURITY DEFINER preview RPCs, `anon` revoked) and
**011** (drops the five permissive policies). Both applied to production.
Re-measured afterwards: a fresh account sees its own profile and nothing else,
while an established user still sees their friends and shared programs.

**One caveat while this branch is unmerged.** 011 is live, but the deployed web
build still selects those tables directly, so invite preview and joining a
shared program are broken on production until this branch merges and Cloudflare
redeploys. Merge before pointing anyone at an invite link.
