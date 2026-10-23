# Study-skill verification

Translation/import extension: both translation directions accept a typed first answer and then explicit self-assessment, allowing equivalent wording. Pinyin is optional for these two skills. Tests cover premature native reveal versus reveal after deliberate comparison, independent schedules/results and prompt changes retaining earlier history. Dictionary import tests cover exact MOE entries through the documented Moedict adapter, English matches from the real bundled CC-CEDICT snapshot, explicit alternate-reading choice, source-preserving edits, partial failures and retries, and reimport retaining edits and reusing all Rems. Compiled SDK tests exercise the complete import/edit/reimport flow in Chromium and phone-sized WebKit against simulated host/MOE responses. Live browser probes separately verify three real Moedict entries; these are not native RemNote acceptance. See DICTIONARY_IMPORT.md and TESTING.md.

Native lists and larger batches: tests verify ordinary parent bullets without list tags, focused external bullets, native rename/move refresh, per-list import identities, legacy flat-import reuse and linked writing/recall moves that retain native practice directions/history. Partial moves retry safely and descendant destinations are refused. Progress, cancellation/resumption, retained edits and previews/imports above 50 words are covered. Compiled desktop/phone SDK flows verify that new cards follow the vocabulary's actual parent after a native move.

Version 0.4.0 adds pinyin-to-character choices, a visible toneless pinyin prompt for tone questions, and self-assessed speaking without a mandatory recording. Unit/component coverage includes homophones, tone-only distractors, recorded and dictionary-only alternate readings of target/distractor polyphones, conservative multi-character reading combinations, pairwise distractor ambiguity, missing readings, word length, insufficient vocabulary, malformed choice metadata, authoring before writes, hidden targets/readings, shuffled-order stability, native-reveal races and independent saved results. Browser checks cover wrong-choice feedback and preserved failure in study, plus speaking without a microphone/file. The historical verification boundaries below still apply: fixtures are synthetic and the RemNote host is simulated.

The existing handwriting exercise remains unchanged. The new pinyin, tone, listening and spoken-comparison widgets have their own Powerup, metadata, native forward cards and result histories.

Automated coverage includes:

- Pinyin normalization, explicit syllable boundaries, tone omission, spelling mismatch and extra syllables; separate tone-choice grading.
- Validated card metadata and HTTPS audio sources, hidden listening targets, current-card identity, lookback refusal, draft retries and reuse of one card per skill/vocabulary.
- Independent skill/reading histories, duplicate-result IDs, concurrent local saves, malformed-history refusal and read-back failures.
- Result preservation through host interruptions, stale async checks losing to native answer reveal, study-only mode, frozen first answers and save retries.
- No microphone request on mount, stopping a delayed microphone result after unmount, file fallback, local-only voice selection and late audio-completion suppression.
- Browser flows in Chromium and phone-sized WebKit for pinyin/tone outcomes, listening playback prerequisites, hidden targets and spoken audio-file comparison. Chromium verifies completed audio playback. The Windows WebKit runtime rejects the WAV fixture (including a separate same-origin probe), so its media tests verify the error message and blocked success grading; they do not establish successful iPhone playback.

Listening/recording browser tests use a generated **silent WAV** only to exercise playback, local media URLs and UI prerequisites. It is not a language recording or speech-recognition test. No speech models have been installed, benchmarked or applied to learner speech.

Live RemNote registration, new study-card authoring, native microphone access, actual Mandarin voice availability, phone recording and cross-device result sync remain to be accepted for these new modules. Prior live handwriting acceptance does not establish these new capabilities. Automatic pronunciation grading is not implemented; see SPEECH_ASSESSMENT.md.
