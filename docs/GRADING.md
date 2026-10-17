# Grading and mastery

Testing starts only on a matching forward writing card whose native answer is hidden. No automatic stroke hints, outlines, backward-stroke acceptance or forced acceptance are enabled. Every stroke must eventually be accepted independently. Engine rejections alone are never interpreted as forgetting.

Accuracy is `(strokes accepted without a non-accidental rejection) / total strokes`. Multiple rejected attempts on one stroke reduce the numerator once, rather than multiplying its weight. This is first-attempt recognizer correctness, not a validated measure of handwriting precision. Accepted strokes are rendered as canonical vectors by Hanzi Writer.

| Level | Required first-attempt accuracy | Successful qualifying reviews to next level |
| --- | --- | --- |
| Beginner | 60% | 2 |
| Developing | 75% | 2 additional |
| Proficient | 90% | 3 additional |
| Mastered | 95% | — |

Thresholds are snapshots of the level at the start of the attempt. A result that fails remains failed even if the saved progress subsequently regresses. Thresholds, promotion counts, spacing, regression count, recognition leniency and accident allowance are configurable. The initial percentages are design parameters, not psychometrically validated cutoffs. Leniency does not automatically change with mastery: mastery tightens the first-attempt requirement, while geometric strictness remains an unvalidated future feature.

## Mandatory recall

**I forgot a stroke**, ending a test for guided practice, or revealing the native answer before completing the test causes automatic failure, regardless of accuracy or level. Unfinished strokes cannot produce a pass. A failed result remains visible when guided practice begins. Practice-only mode never writes tested mastery and never submits a RemNote grade.

## Accidental-input policy

By default, one rejected input per character may be declared accidental. It must be the latest input, within eight seconds, before the next drawing attempt and before completion. The declaration only excludes that specific event from the adjusted first-attempt calculation. Original rejection events, raw accuracy and accident count remain auditable in the UI/history model. Earlier genuine rejections on the same stroke continue to count. This is a limited learner declaration, not proof that an event was accidental; it cannot undo assistance or a forgotten stroke. Set `accidentLimit: 0` to disable it.

## Spaced evidence and regression

At most one test per character and vocabulary entry can qualify on a UTC date, with at least 20 elapsed hours since the previous qualifying test. Both conditions apply after promotion/regression; the timestamp is never cleared at a level change. UTC dates avoid device-timezone changes granting additional credit. Device clock manipulation cannot be securely detected without a trusted time source.

Passed qualifying tests increment the current level's success count. Failed qualifying tests increment a consecutive-failure count; a subsequent qualifying pass clears that failure count. Three qualifying failures lower one level by default, preserving historical peak. Earlier success count is retained until promotion/regression. Same-session repeats are logged but do not advance or regress mastery. Repeated characters in one word are saved once, using the worst result. A word passes only if every component passes its own threshold; a strong easy character cannot mask a weak difficult one.

Records retain the latest 200 tests, their accepted/rejected stroke-event ledgers (including accident declarations), result snapshots, and lifetime attempt count. Raw coordinate paths are used transiently for optional diagnostics and are not retained. Per-character mastery is scoped to the shared vocabulary entry, so related skill cards share it without creating duplicate vocabulary records. The same character in two unrelated vocabulary entries has separate progress in this version.

## RemNote ratings

| Writing outcome | Suggested native rating |
| --- | --- |
| Forgotten/assisted/incomplete, or below threshold | Again |
| Pass with corrections, accident declarations, or below 90% | Hard |
| Independent pass at 90%+ with no corrections/accidents | Good |
| Learner explicitly judges recall effortless | Easy may be selected manually |

A clean Beginner pass does not imply effortless recall. The plugin never automatically suggests Easy. The on-screen selector is an advisory override; the user must click the native RemNote rating. It does not rewrite the measured writing outcome. No queue grading API or repetition-history update is called in this release.

Synced storage is read back before the UI reports a save. Failed/ambiguous saves can be retried with the same unique test ID. Writes serialize within a widget process, but the SDK offers no atomic cross-device merge. Avoid simultaneous offline testing of the same entry on two devices. Export backups are planned; no prototype v0.1 mastery is silently migrated.
