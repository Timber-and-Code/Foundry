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
| Other Data | **Other Data Types** | Yes | Date of birth and gender, optional onboarding fields |

Crash Data is the only one **not** linked to identity — Sentry gets no account
identifier. Everything else is stored against the user's account by design.

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

### Notes for the reviewer

Paste something like this into the Notes field:

> The Foundry generates multi-week strength training programs. Sign in with the
> credentials above.
>
> The demo account already has an active 6-week program with logged history, so
> progression and history views are populated.
>
> Apple Health is optional and off by default. To review it: Settings → Apple
> Health → toggle on. iOS will ask two separate permissions — body weight, and
> workouts. Completing a workout with the workout permission granted writes a
> Traditional Strength Training entry to Apple Fitness and contributes active
> energy to the Move ring. Declining either permission leaves the rest of the
> app fully functional.
>
> Account deletion is in Settings → Account → Delete Account.

---

## 3. URLs

| Field | Value |
|---|---|
| Privacy Policy URL | `https://thefoundry.coach/privacy.html` |
| Support URL | `https://thefoundry.coach/support.html` |
| Marketing URL | `https://thefoundry.coach` (optional) |

Apple requires the support URL to be a real page — a `mailto:` link is rejected.
Both pages must be **live before submission**, not deployed alongside it.

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

## 5. Known open issue

**Row-level security is too permissive on four tables.** Verified 2026-08-16 by
signing in as a brand-new account with no friends and no shared programs:

| Table | Rows visible to a stranger |
|---|---|
| `user_profiles` | all — name, gender, date of birth, body weight |
| `mesocycles` | all |
| `mesocycle_members` | all |
| `friend_invites` | all — live join codes are enumerable |

Training data (`workout_sets`, `workout_sessions`, `training_days`,
`training_day_exercises`, `body_weight_log`, `readiness_checkins`) is correctly
locked to its owner.

The broad reads exist because `previewFriendInvite` in `sync.ts` selects
`friend_invites` by code and then reads the inviter's `user_profiles.name`
directly from the client. Locking the tables without replacing that path breaks
joining a shared program.

**Fix shape:** a `SECURITY DEFINER` RPC that takes a code and returns only that
invite's preview (so a code can be redeemed but not enumerated), then restrict
`friend_invites` to `auth.uid() = user_id` and `user_profiles` to self plus
friends plus co-members of a shared mesocycle.

This should land before the app is publicly available. It is a disclosure and
access-control issue, and it contradicts what the privacy policy tells users.
