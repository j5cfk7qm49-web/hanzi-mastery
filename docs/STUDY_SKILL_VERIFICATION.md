# Version 0.3 study-skill verification

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
