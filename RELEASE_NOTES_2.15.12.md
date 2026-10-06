# 2.15.12 — build 1

A workout you did but never finished is no longer something you have to
skip. And every finished session on the server now carries its real
completion time.

## Left-open sessions
- **A session with logged work is never skipped.** Skip is refused for it
  at the data layer, and the Skip controls on Home, the Schedule day sheet
  and the day stack disappear for one. In their place: Mark complete as
  logged.
- **A session started on an earlier day and never finished is "left
  open", not "in progress".** Home's today card reads LEFT OPEN · THU,
  OCT 1 with "12 of 13 sets logged". The pill says Log the rest and opens
  the day. The one action under it is Mark complete as logged.
- **It is dated the day you trained**, whichever way you close it. The
  completion time is the last set you logged that day. Supabase and Apple
  Health get the same start and end. The week recap and week rollover fire
  exactly as if you had tapped Finish that day.
- **An accidental start with nothing logged is dropped silently.**
- **A session that is both skipped and full of work is contradictory**, so
  the app unskips it on sight. A session skipped past on an older build
  comes back as LEFT OPEN.
- The on-screen timer no longer rewrites the stored session start when it
  re-anchors for a stale session. The stored start is the record.

## Fixed
- **Completion times on the server were overwritten with start times.**
  The set flush re-pushed the session row after Finish with the start as
  the completion, so every finished session read as zero-length. It now
  pushes the real completion time. Older rows are left as they were.

---

1332 tests passing, typecheck clean. No native changes beyond the web
bundle. Not yet verified on device.
