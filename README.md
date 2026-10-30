# Hanzi Mastery

Traditional-first Chinese handwriting and recall for RemNote. **RemNote owns scheduling and native ratings. Independent recall of every stroke is mandatory.**

This README is the single source of truth for current behavior, architecture, development and known limits. [CHANGELOG.md](CHANGELOG.md) is the only chronological project log. Dataset attribution remains in [public/dictionary/SOURCE.md](public/dictionary/SOURCE.md) and [public/audio/SOURCE.md](public/audio/SOURCE.md); full licenses ship in the upload package.

## Version and installation

The current source package is **0.4.13**. This release removes the request for RemNote's native JavaScript execution while retaining the existing study features. The [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1) shows the hosted version; source builds, publication and device acceptance are separate checks. A hosted RemNote 0.4.13 upload has not been verified.

Install the approved hosted version from the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1). Existing compatible cards retain their IDs and need no recreation after an update. GitHub releases, local developer registrations and hosted RemNote uploads are separate records. Publishing a GitHub release does not deploy this plugin to RemNote.

For local development, use Node 22.12+ (24.17.0 tested):

```powershell
npm ci
npm run check
npm run dev
```

In RemNote, open **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. Keep the server running and rebuild after edits. Localhost refers to the device opening it; a desktop server is not a phone installation. `npm run build` creates `release/HanziMastery-0.4.13-plugin.zip`. Upload, approval and installation require separate verification through RemNote's [submission process](https://plugins.remnote.com/advanced/submitting_plugins).

**Native execution is not requested.** The required manifest field is set to `requestNative: false`. The plugin retains handwriting, recall, course practice, reference audio, audio-file selection and spoken self-assessment in its sandboxed widgets; recording is never required. Ordinary RemNote queue integration, native scheduling, existing Rems, progress keys and paused-card state are preserved. Existing host-layout compatibility remains in place. Native JavaScript execution is a separate permission with broader host access, as explained in [RemNote's permission documentation](https://plugins.remnote.com/advanced/permissions).

Microphones do **not** inherently require native mode. The existing recorder successfully captured, returned and played a nonempty clip inside a sandboxed cross-origin browser fixture when its host supplied both `sandbox="... allow-same-origin"` and `allow="microphone"`, with no conflicting ancestor policy. The frame remained unable to access the host DOM. The signed-in RemNote 0.4.4 frame lacks both permissions. Its reproduced opaque origin rejected capture with `SecurityError: Invalid security origin`; microphone delegation alone did not fix this. Origin preservation alone rejected with `NotAllowedError`. A nested frame cannot grant itself capabilities its ancestor withheld. These host settings cannot be supplied by changing the child plugin's HTML or a widget option in SDK 0.0.46. See the [media-capture requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security) and [RemNote widget options](https://plugins.remnote.com/api/interfaces/WidgetOptions).

A separate HTTPS recording-window **test prototype** also returned a playable clip to the opaque sandbox in Chromium using the host's existing popup permission. It is not a shipped plugin feature and is unverified in the iPhone app, where opening an external browser may sever the return channel. The simpler `input type="file" accept="audio/*" capture` mechanism also exists, but current [WebKit iOS source](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/forms/WKFileUploadPanel.mm) maps audio capture to the video recorder; it is not a verified audio-only iPhone solution. Voice Memos file selection remains available. Run `npx playwright test e2e/sandbox-microphone.spec.ts` for the controlled permission matrix and separate-window proof; successful capture uses Chromium's synthetic microphone, not a person's voice. Windows WebKit denial checks do not establish physical iPhone behavior.

An embedded RemNote editor is another supported host-rendered path: a private, sandboxed `RemRichTextEditor` probe opened RemNote's native **Record** panel in the signed-in Windows desktop app. This does not establish microphone capture on iPhone. The inspected installed client routes the native **Done** action to upload, maintains a recovery/upload queue, and writes the attachment into a Rem. No disposable preview/erase API is exposed to plugins. [RemNote's backup documentation](https://help.remnote.com/en/articles/6301627-remnote-backups) also states that uploaded files remain in the desktop files folder after their note references are deleted. Therefore the probe was not integrated into production for disposable practice. No audio was recorded or uploaded; the test-only registration and scratch document were removed. Existing browser recordings remain memory-only.

## Add words and organize lists

Open the command omnibar with `Ctrl+K` (`Ctrl+/` on older accounts), search **Hanzi**, and run **Hanzi Mastery: import, edit and create study cards**. The writing/practice/settings command opens the same workbench. For the course dashboard, choose **Hanzi Mastery: Midterm / course study**.

Connected study lists also use the ordinary Hanzi Mastery queue modes for compatible writing, character-to-Pinyin, spoken-reading and character-to-English cards. The plugin adds the existing Hanzi Writing/Study Powerups to those same Rems; it preserves their fronts, backs, IDs and native schedules. Each review reads the current native answer and exercise-setting child. Radical writing shows the reference character separately and grades only the radical; course writing retains its existing progressive-grading history. Rule and fact cards remain ordinary flashcards. Initial connection runs at startup and can be retried with **Reload Rems** in the course dashboard. Both Compact and Beautiful Queue use the same widgets.

Word-order questions can provide Pinyin and an English meaning for each character before you choose the relationship. These hints are editable `syllables` and `glosses` arrays in the existing exercise-settings Rem and also appear on the ordinary flashcard front. Adding or editing just this help preserves your saved session position. Classification and phrase translation remain on the answer side.

Particle questions can show Pinyin and English vocabulary hints for surrounding words in the example. Edit `targetParticle` and `contextHints` in the exercise-settings Rem; each hint contains `text`, `pinyin` and `meaning`. The tested particle is excluded from all hint text, including multi-character words. Full translations and function answers stay behind reveal. These optional hints also appear on the ordinary flashcard front. Editing only this display help preserves the saved session and answer draft.

To assign a direct shortcut, open **Settings → Keyboard Shortcuts**, search **Hanzi**, and click the pencil beside the desired command. RemNote checks for conflicts and saves the binding in your account preferences; the plugin does not override your existing shortcuts. If an enabled plugin has no commands, use the desktop **View → Reload** menu. A stale cached startup response can cause a CORS load error; fetching fresh assets restored the installed 0.4.1 commands during desktop verification.

1. Choose a list under **Manage lists**, create one, or focus an ordinary RemNote bullet before opening the workbench.
2. On **Import**, paste Traditional words separated by whitespace or one per line. Automatic import uses the first supported CC-CEDICT reading with English. **Review before importing** lets you choose alternate readings and edit study meanings first. **Link matching word recordings**, enabled by default, resolves audio for newly imported words. There is no fixed word limit; previews show 25 words per page.
3. All eight study directions are selected for new words. Expand **Study skills** to select directions or **Vocabulary only**. Existing validation applies: a word can be saved even when a selected card cannot be created; the row identifies failures for retry.
4. Stop lookup/import, edit an imported word and use **Back to import**, or close and reopen the workbench. Each list keeps its own saved input, readings, wording, skill choices and completed rows. **Resume import** finishes pending entries without recreating completed cards.
5. Use **Manual entry** for exact forms and your own wording. **Save word** creates selected skills. **Add writing card** is the explicit writing-only shortcut; **Practice** opens guided practice without creating a card.

The **Vocabulary** page searches all saved words and characters and can filter by selected list. Bulk-select words to add missing skills. Newly authored words live beneath **Hanzi Mastery → All words and characters → word → cards**. An entry with the same exact Traditional form and normalized reading is reused across lists; a different reading is a separate entry. Reuse retains saved wording and source records.

Lists are ordinary RemNote bullets used as **native tags on vocabulary entries**. A word can belong to several lists while its original cards and schedules remain shared. Use **Add to list** when editing, then open the list in RemNote and practice its tagged content. A review through one list affects the same cards in the others. Remove the list tag to remove membership; deleting a shared card deletes it for every list.

Native tagging includes descendant cards in a list's practice queue. Ordinary heading references do not recursively include its cards; portals depend on visible descendants. See RemNote's [practice guidance](https://help.remnote.com/en/articles/6904503-practicing-specific-flashcards) and [document queue rules](https://help.remnote.com/en/articles/8892109-how-does-remnote-decide-what-flashcards-are-part-of-a-document). SDK membership read-back is tested; 0.4.1 queue behavior still needs live-host acceptance.

Older entries stay in their existing locations and remain visible in the library. **Include existing words in master library** adds master-library and collection membership without moving or merging them. Intentional duplicates retain separate IDs and histories. Ambiguous matches require choosing the intended existing entry in the library. Manual entry also offers an explicit separate-entry option. Rename/move list bullets natively, then refresh the workbench.

### Chinese Guru selected-list coverage

Checked October 23, 2026 against the supplied export's selected lists **57** (72 entries) and **Class Stuff** (15). 八 and 十 are shared, yielding **85 unique entries**. All 85 exact glyphs have valid, unchanged assets in the built handwriting package. CC-CEDICT has 82 direct entries; 80 currently have a study meaning that permits automatic import.

Using the readings in the earlier migration preparation, **all 84 entries with a chosen reading have matching audio**: 77 Shtooka and seven MOE Concise. These use 70 distinct recording URLs. The **57** list has 71/72 covered; **Class Stuff** has all 15/15, including 陸 lù, 明 míng and 乎 hū. The remaining entry, 阝, has audio available for either fù or yì but requires a position-specific reading choice. All 72 distinct URLs across the prepared and default-reading checks returned successful audio HEAD responses; this verifies availability, not pronunciation quality or physical-device playback.

Use **Review before importing** for this set. The current first-reading defaults select 足 **jù** and 舌 **jī**; the prepared readings are **zú** and **shé**. All 80 entries currently eligible for automatic dictionary import now have audio. 阝、耂、⺼ still need manual dictionary entries; 巛 and 艸 need supplied study meanings because their source entries only reference variants. Audio fallback does not alter these English/import rules or silently rewrite a chosen reading.

The implemented syllable fallback applies only to isolated characters and requires the exact saved syllable and tone. It can use 陸 lù → 鹿 lù, 明 míng → 鸣 míng and 乎 hū → 呼 hū. MOE adds intact clips for nè, chuò, zhú, ěr and chì, covering the seven remaining selected entries. Longer words retain complete word recordings; clips are never concatenated. The smaller HSK1 pack supplied no additional exact/base-radical matches in the earlier comparison; Congcong's 589 metadata entries lack explicit pronunciation fields, so their reading coverage is unverified. Tone Perfect was not needed for these readings and remains disconnected pending approved access/reuse terms.

Pinyin and English were absent from the original Chinese Guru export; the preparation supplied them from dictionary/Unicode sources. They still need class-specific review, particularly radical names, 阝 and 陸. Local reproducible checks and per-entry results live under the ignored `audit/chinese-guru-coverage.*` paths. No source history, migration files or live knowledge-base entries were changed by this check.

## Edit words and cards

Open a word from the library, imported rows, or its focused vocabulary/card Rem. The **Word** page edits forms, pinyin, study meanings and shared reference audio. Linked previews reflect draft changes. Save once to update generated prompts and answers in place.

**Find matching recording** uses the current form and pinyin to find audio for an existing or manually added word. It fills the draft URL and source credits; **Save changes** applies it to linked cards. A reused syllable's original recorded form appears on the Word page. Existing custom card audio overrides remain intact.

Each card supports a custom cue, listening/spoken audio override and explicit practice direction or pause state. Customizations and paused directions survive later shared edits and reimports. Bidirectional translations expose separate forward/reverse cues. Native answer edits are flagged and require **Restore word answer** before shared updates overwrite them. Use this editor for managed answers to keep native cards and widgets consistent. Cards stored outside their word are flagged: move them beneath the word in RemNote to include them in its tagged lists.

Edits preserve card IDs, native schedules, result histories and original dictionary definitions. A partial update reports unfinished cards and retains a recovery draft; reopen and save again to finish. Traditional-character changes require an explicit correction choice to retain that entry's history. Use **Add more words** for a different word.

CC-CEDICT is now the default source of readings and English for new dictionary imports. Existing vocabulary and its source records are preserved. Curated sense selection and new import readiness gates remain future work; see [dictionary source selection](#dictionary-source-selection).

## Native study lists and exercise modes

Run **Hanzi Mastery: Midterm / course study**, or choose **Midterm / course study** in the workbench. Connect an existing study list using its Rem ID or document link. Questions, accepted answers, explanations, targets and mode settings live in ordinary editable Rems. **Reload Rems** picks up edits. The plugin supplies reusable text, choice, oral, handwriting and touch-circle interactions. Each session makes one pass through its selected activities. Each section and **All sections** have separate saved lists, positions and drafts; **Resume** opens the selected section's save without inserting misses again. The activity filter applies to new sessions and does not replace a resumed list. Starting a new session replaces only that section's resume slot; completed exercise results remain saved. Finish, then choose **Practice missed** for the most recently failed activities or **Practice unstudied** for activities without a saved result, including skips. Both focused buttons respect the section/activity filters. The private handoff importer is an optional one-time seed adapter; an already connected list is never overwritten during audio reimport.

The cleaned midterm list contains 548 activities across seven sections (42/153/228/22/16/3/84). Its scheduled cards remain paused. All 41 numbered 大學 lines have visible Pinyin and individually cut excerpts of the original class-folder recordings; select **Oral reading → reading → Practice selected (41)** for shuffled practice, or **memorization** to recall the assigned opening. Reload Rems after native edits. Formation choices use English labels, and 99 radical exercises reuse the handwriting grader while displaying the source character (e.g. 海 → write 氵). Its 72 radical recall cards received conservative Chinese Guru Pinyin-history scheduling estimates through RemNote's Anki importer. Other skill statistics are archived separately; native ratings control future schedules. All 64 original instructor recordings and 41 line clips have been uploaded to a private audio sublist in RemNote; the plugin resolves their attachment Rems so another device can load them without another manual ZIP upload. Initial playback needs a connection; physical iPhone sync and offline caching remain unverified. Classroom PDFs/audio, private attachment URLs and personal study history are absent from the plugin upload. Device-local ZIP audio remains a fallback. See [course integration and limitations](docs/MIDTERM_INTEGRATION.md).

Course and workbench popups now scroll within their window on desktop and mobile. Read aloud before revealing the instructor recording; optional recording completion also reveals it. Listen to the full reference before judging your pronunciation and tones. Missing audio can be skipped without a result. This is self-assessment, not automatic speech grading.

By default, a completed course exercise also rates its verified matching forward RemNote card **Good** or **Again** through the native scheduler. **Update linked RemNote card schedules** on the dashboard turns this off. Paused flags and prior history are retained; old practice events are not backfilled. Only a unique linked exercise/card can be rated. Paused cards are resolved through native card IDs; a first read-only discovery indexes the connected list and can take longer on a large knowledge base. The index stores no review history or unrelated cards. A saved activity offers **Retry card update and continue** after an update failure, or **Finish saved result** after reopening. Both use the original assessment. A durable pending/confirmed receipt prevents duplicate callbacks from rating twice. An interrupted, unconfirmed rating is checked against history and never blindly resent. Concurrent cross-device reviews cannot be made atomic by the SDK; an ambiguous receipt stays unresolved rather than risking a duplicate.

Practice results and writing progression use `hanzi-mastery-study-pack-v1:`; the connected-list pointer uses `hanzi-mastery-native-study-list-v1`. Existing handwriting/card histories are preserved. **Disconnect list (keep Rems and progress)** removes the active dashboard while retaining editable notes and saved results. Reconnect the same list to restore it. See the [integration manual](docs/MIDTERM_INTEGRATION.md) for authoring, source ambiguities, persistence limits and device acceptance.

## Study directions

| Direction | Exercise |
| --- | --- |
| Writing | English/pinyin cue → recall every stroke |
| Meaning → characters | Meaning → handwriting with the checked Hanzi Writer canvas |
| Characters → meaning | Freeze a typed first answer, compare and self-assess equivalent English |
| Pinyin recall | Type the full reading, including tones |
| Tone recall | Choose dictionary tones with four quadrants and a neutral center |
| Character recognition | Pinyin → four shuffled character/word choices |
| Listening | Play the reference, then type dictionary pinyin |
| Spoken practice | Say the word, play a reference and self-assess; optional recording |

New translations share one bidirectional Rem with independent native forward/backward cards and result histories. Other skills use separate Rems; all eight directions normally occupy seven Rems. Older separate translations stay separate. Repeated creation reuses completed cards without resetting content or activating paused cards.

In the ordinary RemNote queue, submit the first attempt and wait for **Saved · Rate in RemNote**. Reveal and rate using native controls. These review widgets suggest a grade and leave submission to you. Early answer reveal records failure; studying afterward preserves that result. Guided writing practice saves no test result. The separate course dashboard can submit Good/Again for a completed linked exercise when its schedule-update setting is enabled, as described [above](#native-study-lists-and-exercise-modes).

Pinyin accepts marks or numbered syllables, including `nü3`, `nv3` and `nu:3`. Unmarked syllables mean neutral tone, so `ren` does not pass `rén`. Listening checks dictionary-pinyin transcription. Recognition filters homophones/tone-only alternatives using saved readings and bundled pinyin-pro; four unambiguous equal-length choices are required. These checks filter ambiguity, not establish Taiwan pronunciation authority.

Reference audio may be an HTTPS recording or an available **local** Mandarin voice. Lookup tries Shtooka first, preferring the actual form or an approved radical alias before reusing an intact single-character clip with the same explicit syllable/tone. It then tries matching Commons audio. Remaining isolated-character gaps use MOE Concise, again matching the exact tone. Word recordings are never assembled from syllables. The original recorded form is retained in provenance; writing targets, dictionary definitions and card identities stay exact. A 糸 mì clip cannot substitute for 糹 sī; a separate sī clip can. Credits appear on the Word page and during playback without exposing recorded Hanzi in study prompts. Automatically linked audio is cleared when its word/reading changes; explicit card audio overrides remain. Missing recordings do not block vocabulary import. Playback must complete before successful listening/spoken comparison. No remote synthesis fallback or automatic spoken-pronunciation grading exists. Optional recording starts after a gesture, lasts at most 20 seconds and stays in memory; selected audio files must be smaller than 10 MB.

## Writing, mastery and Taiwan standards

Traditional is default. Simplified requires an explicitly supplied form; no automatic conversion occurs. Targets contain 1–12 Han characters without punctuation/spaces. Hidden metadata identifies targets; ordinary text, OCR and the prototype's `WRITE:` convention are not used to infer them.

Every stroke must be recalled. First-attempt recognizer correctness is **not validated penmanship precision**. Forgotten strokes or early reveal fail a test. Remembered but misdrawn strokes reduce accuracy. Outlines, animation and retries teach afterward without replacing the result. Experimental geometry feedback never affects pass/fail.

| Stage | Required first-attempt correctness |
| --- | --- |
| Beginner | 60% |
| Developing | 75% |
| Proficient | 90% |
| Mastered | 95% |

Defaults require 2, 2 and 3 qualifying reviews for promotions, separated by at least 20 hours **and** a UTC date boundary. Three failures cause gentle regression; peak is retained. Same-session practice cannot promote mastery. Repeated characters in a word use the worst result from that test. Thresholds and recognition leniency are separate settings.

Accident recovery defaults to one per character: only the latest rejected stroke within eight seconds, before another stroke/completion, can be forgiven. The raw ledger remains auditable. Engine/host recovery retains completed strokes and mistakes.

The package includes unchanged upstream data for **9,574 exact characters**, with 學國書語聽體愛 also embedded. The October 16, 2026 MOE comparison established counts, not full shape/order compliance:

| Character | Bundled/MOE count | Outstanding issue |
| --- | --- | --- |
| 學 | 16 | Upstream begins with the left group; MOE starts with central crossed strokes |
| 國 | 11 | Full order/shape audit pending |
| 書 | 10 | Full order/shape audit pending |
| 語 | 14 | Full order/shape audit pending |
| 聽 | 22 | Full order/shape audit pending |
| 體 | 23 | Detailed regional comparison of 骨 also pending |
| 愛 | 13 | Full order/shape audit pending |

Rejection of a Taiwanese sequence does not establish learner error. Consult the [MOE reference](https://stroke-order.learningweb.moe.edu.tw/). `src/data/overrides.ts` is an empty, validated registry. An audited correction can reorder licensed upstream strokes, medians and radical indices together; each needs attribution and per-stroke checks. MOE animations use CC BY-NC-ND 3.0 TW; no MOE vectors are redistributed or converted. Upstream vectors retain the [Arphic license](https://github.com/chanind/hanzi-writer-data).

## Dictionary, interoperability and privacy

Dictionary lookup uses bundled CC-CEDICT locally for both readings and English. It generates an MDBG word link and a Chinese Wiktionary link from the word instead of storing a dictionary URL table. New imports do not query MOE/Moedict. Existing MOE-derived records retain their original definitions, readings and CC BY-ND 3.0 TW attribution. Original source definitions remain separate from editable study wording; no model-generated translation is used.

Optional audio lookup uses the local **133,663-byte** Shtooka index (8,569 records), dynamic Commons metadata and a **36,093-byte** MOE routing index (6,472 supported single-character recordings). Audio is not bundled. Shtooka's server lacks metadata CORS headers; MOE URLs are generated as `https://dict.concised.moe.edu.tw/sound/word/<ID>.mp3` from its official single-character index and canonical readings. Full-entry `sound/mean/` narration is never used. The original MOE usage notice ships unchanged with attribution; CC-CEDICT remains the English dictionary.

Playback uses Shtooka's identical-ID FLAC file when the browser reports FLAC support without Ogg Vorbis support. This format choice happens only on playback and does not change saved recording credits or custom audio URLs. Actual device decoding remains a separate compatibility check.

For missing Shtooka matches, lookup sends the exact word/base radical to Wiktionary and Commons. Ambiguous regional templates, other dialects, unsupported licences and missing credits are skipped. Wikimedia failure/cooldown does not prevent local MOE lookup, and upstream `Retry-After` is respected. The selected URL, actual recorded form, author/version and licence are saved with the word and cards; reviews do not repeat searches. Failed services leave vocabulary import usable with a concise notice. Turning the recording checkbox off skips lookup. Tone Perfect sends no requests because approved access and redistribution terms have not been established.

The unchanged CC-CEDICT snapshot is dated **2026-10-17T16:45:37Z**, retrieved October 21, with 125,297 entries. Compressed SHA256: `2680af828c0d949b544c9399b4dc8503788c99150ab73887600fed6b4f880b26`. It uses CC BY-SA 4.0 with its original header and [attribution](public/dictionary/SOURCE.md). Builds never refresh it. Intentional updates must review the upstream version/license, update attribution and checksums in adapter/packager, then rerun dictionary/import checks.

The file-conversion CLI is separate; no file-import UI exists yet:

```powershell
npm run import -- --format pleco --input words.txt --output words.json --bare-script traditional --markdown words.md
npm run import -- --format csv --input words.csv --output words.json --mapping mapping.json
```

Converters refuse overwrite. Pleco text supports tabs, `//Category`, and Simplified `[Traditional]`; bare forms require explicit script choice. CSV/TSV support mapped headers including `traditional`, `simplified`, `pinyin`, `meanings`, `categories`, `source`, `partOfSpeech`, `audio`, `tocflLevel`, `tocflSource`, `tags`, with semicolon lists. Canonical JSON preserves provenance/unverified labels; Markdown creates plain notes. SRS history is not migrated. Fixtures are synthetic; ChineseGuru's real schema, Pleco XML/history/audio and physical iOS Pleco URL handling remain unverified/unsupported.

The plugin requests read/create/modify access to author and link Rems. It does not delete existing notes or rewrite prior SRS history. Enabled course schedule updates submit new Good/Again ratings through RemNote's scheduler; ordinary queue reviews retain manual native ratings. Voice bytes are not saved/uploaded; closing discards them. Reference audio is fetched from its HTTPS source only when played. Local assets do not guarantee cold offline RemNote operation. RemNote manages its storage and sync.

## Dictionary source selection

Research checked October 23, 2026. **No reviewed upstream was verified to supply the complete combination of Taiwan-standard readings, learner-friendly English senses, matched word audio and reusable data for this plugin.** The user subsequently accepted Mainland Mandarin audio and selected CC-CEDICT as the default English source. New imports use CC-CEDICT readings/English with separate matched recordings. MOE's **國語辭典簡編本 (Concise Dictionary)** now supplies fallback single-character audio; its Chinese definitions have not replaced the English source.

MOE identifies the Concise Dictionary as intended for students and Mandarin learners, with plain Chinese explanations, frequency-informed vocabulary and modern pronunciation review. Its Revised Dictionary, used through Moedict by earlier imports, also covers historical language. See MOE's [dictionary comparison](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html), [editorial principles](https://dict.concised.moe.edu.tw/page.jsp?ID=23) and [preface](https://dict.concised.moe.edu.tw/page.jsp?ID=4&la=0&powerMode=0).

### Measured compatibility

The official [Concise download](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html), version **2014_20260929**, was inspected directly. Its text ZIP SHA256 is `5bab99dac44ad7a6ccdcf481e770e8aca05ede7445c4cc25b8199e0e5df64cf2`. Counts below are our comparison with installed `hanzi-writer-data@2.0.1`, not coverage claims made by MOE:

| Check | Result |
| --- | --- |
| Reading records / distinct headwords | 45,178 / 44,445; different readings can share a written headword |
| Pinyin and Chinese definitions | Present in every record; no English-definition column |
| Complete exact-character coverage within current writing-target format | 44,532 records, **98.57% of all records** |
| Missing Hanzi Writer characters across headwords | 373 distinct Han characters, including 揹、嚐、溼、祂、痠; no substitutions were made |
| Current 1–12 Han-character target format | 59 records fall outside it, chiefly punctuated sayings |
| Current one-syllable-per-character reading validator | A further 65 records do not pass, including legitimate erhua forms and records needing source inspection; this does not establish that all those readings are linguistically wrong |
| Stroke-count agreement | 760 distinct covered single-character headwords differ between the MOE count and Hanzi Writer path count; counts alone do not establish order/shape correctness |

Coverage means the exact character assets exist; it does **not** mean MOE stroke conformance. Examples of count differences are 骨 (MOE 10, Writer 9), 花 (8/7) and 為 (9/12). These require individual glyph/sequence audits before changing grading. The existing Taiwan-override work remains separate from dictionary selection.

### Audio and English gaps

The official pronunciation-pack directory and its included index were inspected with byte-range requests rather than downloading the entire **1.52 GB** archive. It contains **6,476 WAV files**. Its index maps individual character readings, with one legacy image-placeholder label; it supplies no verified multi-character word-pronunciation coverage. For example, it does not provide an indexed 學習 or 銀行 word clip. The separately published five-part audio collection is labelled **whole-entry audio**, so it must not be treated as a complete isolated-word reference pack. MOE's [operating instructions](https://dict.concised.moe.edu.tw/page.jsp?ID=9) distinguish single-character, full-entry and foreign-language playback.

The Chinese explanations are more accessible than a historical dictionary, but they do not replace English study meanings. Reusing our existing CC-CEDICT reading-match logic found potential English entries for 35,120 records; that is a measured fallback overlap, not a new learner dictionary or a complete English solution.

The [official usage notice](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/conciseddict_10312.pdf) requires preservation of original entry content, version and notice under CC BY-ND 3.0 TW. Rewriting/translating official definitions or extracting edited clips from full-entry recordings is not permission established by this research. Any independent learner wording must have its own provenance and remain separate from the unchanged MOE record.

### Other candidates

| Candidate | Finding / remaining gap |
| --- | --- |
| [Taiwan Mandarin API](https://www.taiwanmandarin.com/api) | Convenient Taiwan-oriented readings, frequency and TOCFL fields. Its English glosses are explicitly model-generated, approximately half the word glosses are documented as unfinished, and the documented schema has no audio field. Promising for evaluation, not a verified complete provider. Its [source notes](https://www.taiwanmandarin.com/data) disclose the generated text. |
| [English Wiktionary via Kaikki](https://kaikki.org/dictionary/Chinese/index.html) | Structured English senses, pronunciation variants and some audio. Requires dialect, sense and media-rights filtering; complete matched Taiwan Mandarin word audio was not established. The [垃圾 entry](https://kaikki.org/dictionary/Chinese/meaning/%E5%9E%83/%E5%9E%83%E5%9C%BE/%E5%9E%83%E5%9C%BE.html) illustrates why a Taiwan reading and the first available audio must not be assumed to match: the surfaced recording is labelled Cantonese. |
| [Skritter vocabulary API](https://skritter.com/api/v0/docs/entities/vocabs) | Closest documented single API shape: written form, reading, definitions and audio URL. Its [published reference policy](https://docs.skritter.com/article/219-standard-references-for-skritter-chinese), last updated in 2022, specifies Mainland pronunciation references; comprehensive Taiwan coverage was not established. Its [terms](https://skritter.com/terms) limit API use to personal use without separately discussed terms and do not establish rights to bundle its content. No authenticated service/coverage test was performed. |
| [Oxford / ABC / Tuttle learner dictionaries](https://store.pleco.com/products.php/payment.php?coupon=&regid=&sku=P2IMC2) | Stronger editorial English candidates, but dictionary and voice packs are separate products. App purchases do not establish integration/redistribution rights. Hanping explicitly [limits its ABC licence to its mobile apps](https://hanpingchinese.com/abc/), excluding its own web app. A publisher agreement and Taiwan audio/reading audit would be needed. |
| Dong Chinese / HanziHero dictionary | These do not establish a replacement English source merely by offering a different interface: Dong's [資料 entry](https://www.dong-chinese.com/wiki/%E8%B3%87%E6%96%99) credits CC-CEDICT, and HanziHero's [dictionary documentation](https://hanzihero.com/docs/dictionary-beta/) says it imports CC-CEDICT. Their separate curated teaching content was not assessed as a reusable dataset. |

### Recommended direction

For a future strictly Taiwan-standard reference layer, MOE Concise remains the leading candidate. The implemented default follows the user's later choice: CC-CEDICT supplies new import readings/English, with separate matched word recordings. This is a multi-source system with one saved word record, not a claim to have found an all-in-one upstream dictionary.

The plugin can still have **one canonical record per written form, reading and selected sense**, with stable source IDs/version, an authored short study gloss, accepted meanings, examples and an audio asset verified against that reading. Every mode reads that same record; Hanzi Writer supplies the linked character assets. Source records and user edits remain distinct. A flat list of all dictionary meanings is not a dependable production cue, even when it comes from a good dictionary.

For source-quality acceptance, verify the same sample entries across all modes: 學習、朋友、垃圾、星期、銀行、行、重、覺得、衣服、什麼 and missing-asset characters. Check sense choice, regional reading, actual spoken audio, neutral tones/sandhi, licensing and exact stroke availability. A first curated TOCFL/common-word subset is more reviewable than declaring an entire mixed-source inventory complete. Matching metadata alone does not complete this editorial and listening audit.

### English study meanings

The recommended free English base remains **CC-CEDICT**, which the plugin already bundles. Its [publisher's download page](https://www.mdbg.net/chinese/dictionary?page=cedict) explicitly permits reuse and adaptation under CC BY-SA 4.0. A learner-facing improvement should select a useful sense and provide a short study meaning with accepted equivalents for that sense, while keeping the complete original entry as a separate reference. For example, a card for the data/information sense of 資料 can use that concise cue without adding every unrelated or specialized use of the written form. Retain sense context and usage qualifiers; selecting the first gloss or stripping parenthetical text automatically is not an established editorial solution. Independently authored wording and adaptations must retain their correct provenance and applicable licence.

Use [English Wiktionary / Kaikki](https://kaikki.org/dictionary/Chinese/index.html) as a selective secondary reference for missing or unclear senses, with explicit language, reading and part-of-speech selection, rather than merging its full multilingual entry into a card. It is not a uniformly edited learner dictionary. A reviewed common-vocabulary study layer and the existing word editor are the practical free path; no complete replacement learner-English source was verified and no gloss/sense migration has been implemented.

### Prerecorded audio with Mainland Mandarin allowed

On October 23, the user clarified that **Mainland Mandarin pronunciation is acceptable**. Taiwan-only synthesis is therefore no longer the sole audio acquisition direction. Traditional writing and dictionary selection are separate decisions. Recordings must still match the selected word reading; a regional alternate must not silently contradict displayed pinyin. This is a source-selection preference, not an implemented change to pronunciation validation or grading.

Free prerecorded audio supplies part of the common-vocabulary coverage. The following are published recording counts, not measured matches against our vocabulary, unique headwords or listening-quality scores:

| Source | Evidence and suitability |
| --- | --- |
| Shtooka / University of Caen, Yue Tan (`cmn-caen-tan`) | The [preserved collection catalogue](https://fsi-languages.yojik.eu/audiocollections/audiocollections.html) lists **8,597 recordings**. The [original collection notice](https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/readme.txt) grants **CC BY-SA 3.0 US**. A [sample on Commons](https://commons.wikimedia.org/wiki/File:Zh-c%C3%A0nl%C3%A0n.ogg) identifies the speaker as from Liaoning, China. Strongest human-recorded base candidate reviewed here. Exact common-word coverage, metadata quality and playback quality remain to audit. |
| Shtooka HSK1 and Congcong | The same catalogue lists **1,000** and **589 recordings**, respectively. Their original notices specify [CC BY 2.0 FR](https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-balm-hsk1/readme.txt) and [CC BY 3.0 US](https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-balm-congcong/readme.txt). Potential supplements; overlap has not been deduplicated. The catalogue's `chi-balm-hsk1` and `cmn-balm-hsk1` labels must not be counted as two independent word inventories without inspection. |
| Wikimedia Commons / Lingua Libre | The inspected [Mandarin category](https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn) lists **4,108 files**, including phrases, variants and duplicates; this is not 4,108 new dictionary words or exclusively Mainland speakers. Preserve each file's language, speaker, source and licence. The inspected [启蒙 recording](https://commons.wikimedia.org/wiki/File:LL-Q9192_(cmn)-CanonNi-%E5%90%AF%E8%92%99.wav) is CC0, while other recordings have their own terms. Candidate supplement requiring reading/accent and quality checks. |
| [CEDICT TTS archive](https://github.com/cjhoward/cedict-tts) | Already-generated **synthetic**, not human, male/female Baidu MP3s. The author claims nearly all entries in the included CC-CEDICT snapshot and declares the MP3s CC0. Files are keyed by numeric pinyin, with explicit warnings about 一/不 tone changes. Actual coverage, naturalness, filename collisions and upstream generation/reuse provenance were not verified; do not treat a repository-level licence assertion as a completed source-rights audit. A fallback candidate rather than an established human-audio source. |

Do not derive permissions from free playback or an open dictionary's text licence. [ChinesePod's current terms](https://www.chinesepod.com/terms) do not provide a general right to copy/repackage its word recordings. [Forvo's API terms](https://api.forvo.com/documentation/general-information/) prohibit caching and expire audio links after two hours, so its API is not a free distributable offline pack. Shtooka collection notices were read from the maintained Yojik preservation mirror. Follow-up implementation located the valid `flac/index.tags.txt` metadata and produced 8,569 index rows within the plugin's 1–12 Han-character form rules; the catalogue's larger total includes unsupported forms. `scripts/build-audio-index.mjs` rebuilds this index explicitly from source metadata and embeds its SHA256. The smaller Shtooka packs are not bundled.

The implementation uses licensed Shtooka recordings and the isolated-syllable fallback first, dynamically resolves matching Commons recordings, then uses MOE Concise for remaining single-character readings. It retains source/reading and licence metadata with each selected recording. No full audio pack or synthesis engine is bundled, and no existing word readings are migrated automatically. Listening quality and inventory completeness are not established by the source metadata alone; source match and playback/transport tests do not certify human pronunciation quality.

Additional source status:

- **MOE Concise single-character clips** are now integrated through a compact factual audio-ID/reading index and direct official MP3 links under the [CC BY-ND 3.0 TW terms](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html). Only complete original clips are used. The maintenance command is `python scripts/build-moe-audio-index.py <official text ZIP> <official single-character audio-index XLSX>`; it never runs during normal builds. Snapshot/checksums and the original usage notice are in the packaged audio attribution.
- **Broader Commons / Lingua Libre lookup** can locate syllable recordings absent from a character's Wiktionary page. For example, [lù recorded as 路](https://commons.wikimedia.org/wiki/File:Zh-l%C3%B9.ogg) is explicitly Mandarin, a Beijing speaker and CC BY 2.0 FR. General Commons search is not integrated; the current lookup still selects only explicit Mandarin matches from an exact entry.
- **MSU Tone Perfect** is the user's requested next source if MOE cannot supply a reading. Its creators describe 410 syllables in four tones by six speakers and [educational/noncommercial restrictions with approved bulk access](https://ideah.pubpub.org/pub/hh90jpsu/release/5). The paper's CC BY licence does not license the recordings. The live access site returned HTTP 429 during verification; no approved inventory or redistribution permission is available, so this source remains disconnected. MOE covers the five residual syllables for the checked import, so Tone Perfect was not needed. No request was sent on the user's behalf.

**Individual-file playback is feasible without an archive download.** HTTP HEAD probes on October 23 returned 200 for the mirror's [安全 Ogg recording](https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/ogg/cmn-99dda64b.ogg) (`audio/ogg`, 16,293 bytes) and its FLAC counterpart (64,568 bytes). A [Commons redirect for the inspected 启蒙 recording](https://commons.wikimedia.org/wiki/Special:Redirect/file/LL-Q9192_%28cmn%29-CanonNi-%E5%90%AF%E8%92%99.wav) resolved to `upload.wikimedia.org` with a 200 WAV response (99,372 bytes). These are transport checks, not listening tests or full RemNote/mobile playback acceptance. External availability and supported audio formats still matter.

Only the selected clip transfers when played; audio bytes are not cached persistently by the plugin. The stored URL includes author, licence and source-page credits. Wikimedia's [technical reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical#Hotlinking) allows hotlinking but recommends copies for control and warns against relaying every user search to its servers. The implementation resolves exact entry/file metadata during import and saves the result instead of searching during reviews. Shtooka's opaque IDs come from the compact local index. External availability and actual mobile audio playback remain device acceptance checks.

### Speech synthesis options

Research checked October 23, 2026. **Azure's prebuilt Taiwan Mandarin neural voices remain the leading candidate for a Taiwan-controlled online synthesis comparison; no provider has been auditioned against our cards or integrated.** With Mainland Mandarin now acceptable, the prerecorded-source pilot above takes priority over assuming a hosted speech engine is required. Synthesis can fill remaining word-audio gaps independently of dictionary selection. It does not establish MOE pronunciation correctness by itself.

| Option | Fit for Hanzi Mastery |
| --- | --- |
| [Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) | Lists `zh-TW-HsiaoChenNeural`, `zh-TW-YunJheNeural` and `zh-TW-HsiaoYuNeural`. Its [Taiwan phonetic set](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets#zh-tw) accepts explicit Zhuyin through SSML `phoneme alphabet="sapi"`. This is a strong fit for requesting the canonical reading of a polyphonic character/word rather than relying on text guessing. Actual rendering, neutral tones and sandhi still need listening review. |
| [Google Cloud TTS](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types) | Lists three Taiwan `cmn-TW-Wavenet` voices, A/B/C, and three Standard voices. The inspected catalogue lists Mandarin Chirp 3 HD under `cmn-CN`, not a dedicated `cmn-TW` variant; a Mainland language label must not be treated as verified Taiwan support. A useful comparison candidate. Taiwan-specific pronunciation override behavior was not verified. |
| [BreezyVoice](https://github.com/mtkresearch/BreezyVoice) | MediaTek's Taiwan Mandarin model supports manual Zhuyin correction. Its repository and [model card](https://huggingface.co/MediaTek-Research/BreezyVoice) declare Apache 2.0. The documented runtime is Python/ONNX with CPU or GPU execution and a reference speaker recording. Promising for self-hosting or generating reviewed assets in advance; no supported in-plugin/browser deployment was established. Use a speaker reference whose reuse is authorized. |
| [Kokoro.js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) | Demonstrates an 82M-parameter model running in the browser with WASM/WebGPU. That establishes technical feasibility of local synthesis, not a complete Taiwan Mandarin solution: the browser documentation demonstrates English, and the separate [Chinese model](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh) does not establish a tested Taiwan browser pipeline. Model download, pronunciation frontend, memory, cold-start time and mobile host support require evaluation. |
| Existing device voices | Already implemented through browser `speechSynthesis`, filtered to voices reporting `localService`. Available voices depend on the device/browser. Useful as an explicit fallback; they do not provide a uniform voice inventory or our own enforceable pronunciation lexicon. |

Cost and output rights are separate checks. Azure's [pricing page](https://azure.microsoft.com/en-us/pricing/details/speech/) lists 0.5 million billable characters/month for its free Neural tier, but its [product terms](https://www.microsoft.com/licensing/terms/product/MicrosoftAzure/all) explicitly grant prebuilt neural output use rights to **paid-tier** customers; do not assume the free tier licenses a distributed audio pack. Its [billing documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech#billable-characters) counts each Han character twice and also counts most SSML markup. Although the pricing page rendered placeholders, a follow-up query to Microsoft's [public retail catalogue](https://prices.azure.com/api/retail/prices?$filter=armRegionName%20eq%20%27eastus%27%20and%20contains%28meterName%2C%20%27Neural%27%29) verified **US$15/million billable characters** for `Azure Speech`, `S1 Neural Text To Speech Characters`, `eastus`, USD on October 23. That is US$30/million Han characters before markup. The catalogue currently calls the service `Foundry Tools`. Google's [current WaveNet price](https://cloud.google.com/text-to-speech/pricing) is **US$4/million characters** after its listed four-million-character free allowance, with billing enabled. Its [documentation](https://docs.cloud.google.com/text-to-speech/docs/basics) permits generated audio in applications subject to the service terms. BreezyVoice and Kokoro have no model licence/per-character fee; local hardware/electricity or rented compute, development and delivery remain costs. Backend hosting, storage and delivery costs are additional for cloud synthesis too.

For an illustrative 10,000 unique words averaging three Han characters, one voice at one rate would cost US$0.90 in Azure text charges or US$0.12 at Google's paid WaveNet rate, before free allowances, SSML markup, regeneration, taxes and delivery. These are text-only arithmetic examples, not complete production estimates: phoneme tags add billable characters. Replaying saved audio during later card reviews adds no synthesis fee; fetching it can still incur delivery charges. New voices, rates or changed readings can require regeneration.

Published evaluation evidence does not establish a winner for our exact cards. The [BreezyVoice paper](https://arxiv.org/html/2501.17790v1) reports a Taiwan-oriented blind preference test with three listeners and ten samples, but competing services are anonymized and the authors conducted the study; it is promising evidence rather than an independent, named-provider flashcard comparison. [CN-NewsTTS Bench](https://github.com/Jayden-X-L/cn-news-tts-bench/blob/main/README.en.md) favors its tested Azure configuration over Google for automatic raw-input Chinese news target accuracy, but it excludes pronunciation overrides and is not a Taiwan single-word/learning assessment. Do not turn its scores into card accuracy or generic star ratings. Our practical ranking remains Azure for controlled-reading trials, Google for a low-cost comparison, BreezyVoice for self-hosted asset generation, and Kokoro/device voices for further offline evaluation. No listening verdict has been established for the chosen voices.

The proposed workflow is to generate and review a common-word audio set in advance, then reuse the same audio asset across linked cards. Optional generation for new/custom words would run through an authenticated, rate-limited backend; provider credentials belong there, not in the distributed plugin. Submit only the requested study text/reading. Retain explicit recordings as overrides and keep local device playback as an optional fallback. Cache identity must include the written form, chosen reading, provider/voice, locale and synthesis settings/version, so editing a reading cannot replay stale audio. Cross-device/offline persistence remains a separate host-storage decision.

Evaluate Azure against Google on the same Taiwan reading samples listed above, plus standalone alternate readings, third-tone sequences, 一/不 changes, neutral-tone words and slow playback. For BreezyVoice, also check short-word stability with the selected authorized speaker reference. Listen for omitted/repeated syllables and distinguish documented control support from verified output quality. No account, paid generation, model download, backend, audio cache or runtime behavior was changed by this investigation.

## Architecture and persistence

| Area | Responsibility |
| --- | --- |
| `src/core` | Pure schemas, grading, ledger, mastery, pinyin and study definitions |
| `src/services/library.ts` | Global inventory/identity, native list tags and library setup |
| `src/services/vocabulary.ts` | Confirmed writes, reuse and source-preserving shared edits |
| `src/services/cards.ts` | Linked-card inventory, creation, update planning and confirmed writes |
| `src/services/recall.ts` | Recall cards, direction context, choices and result histories |
| `src/services/serial.ts` | Shared owner/key queues for same-process read/modify/write |
| `src/services/remnote.ts`, `persistence.ts` | Review identity, writing-card creation and mastery persistence |
| `src/services/dictionary.ts`, `characters.ts` | Explicit lookup and local stroke loading |
| `src/services/recordings.ts`, `recordingIndex.ts`, `moeRecordings.ts`, `http.ts` | Provider fallback, indexed exact-syllable matching, MOE routing and bounded requests |
| `src/studyPacks`, `src/services/nativeStudyReviews.ts` | Editable course lists, section sessions, exercise hints, course results/schedule receipts and ordinary-queue bindings |
| `src/ui` | Exercises, canvas, word/card editor, library and import drafts |
| `src/widgets` | SDK entrypoints, review widgets and workbench |
| `src/importers`, `scripts` | File adapters, CLI, loopback server and packaging |
| `tests`, `e2e` | Pure, component, adapter and browser regressions |

Vocabulary uses `hanzi-vocabulary-v2`, writing `hanzi-writing-v2`, and recall the `Hanzi Study` Powerup. JSON lives in hidden `schema` metadata. Manually tagging an arbitrary Rem does not supply valid metadata. Vocabulary supports exact forms, readings, meanings, source/categories, examples, audio, tags, dictionary links and TOCFL provenance; the UI exposes common fields.

Writing schema example:

```json
{"version":2,"skill":"writing","vocabularyId":"REAL_REM_ID","traditional":"學習","simplified":"学习","prompt":"study (xué xí)","customPrompt":false}
```

| Synced key family | Purpose |
| --- | --- |
| `hm:v2:collection` | Collection identity |
| `hm:v6:library`, `hm:v6:library-draft` | Library identity and setup reservation |
| `hm:v6:word:<identity>` | Global creation/retry index; native inventory is authoritative |
| `hm:v6:lists` | Remembered list IDs; membership itself is native tags |
| `hm:v6:card:<vocabularyId>:writing` | Writing draft/complete link |
| `hm:v3:card:<vocabularyId>:<skill>` | Recall draft/complete link |
| `hm:v6:import-draft:<listId>` | Durable per-list workflow |
| `hm:v6:edit-baseline:<id>`, `hm:v6:edit-draft:<id>` | Baseline and desired changes until all linked updates finish |
| Existing mastery/result keys | Stable vocabulary/character and per-skill history; old result namespace pinned on edits |

Old dictionary retry keys remain; native inventory discovers their entries without merging histories. Prototype `hanzi-mastery-v1` state is not silently migrated. Future migration must preview mappings and preserve FSRS data.

Import batches reuse their vocabulary inventory for recognition choices and skip legacy-card scans for newly created words. Draft cards stay paused until metadata read-back. Edits validate the complete plan first, preserve parent/direction unless explicitly changed, and confirm fresh text/metadata. Saves use retry IDs, queues and read-back; histories retain 200 tests while aggregate/peak state survives trimming. This is not an atomic cross-device transaction. There is no durable pending **review-result** outbox: wait for saved confirmation before leaving.

SDK 0.0.46 is pinned. Widget card ID is optional; current-card/Rem identity must match. Repetition dates identify review attempts. `Card.getRem` returns unwrapped data, so adapters use `rem.findOne`. SDK transaction callback behavior was unreliable in verification; individual confirmed writes are used. UUIDs use `getRandomValues` where `randomUUID` is unavailable. `WidgetBoundary` reports caught startup failures as HM-START.

## Build and verification

Run installs/downloads/builds sequentially; `npm ci` replaces dependencies in use. Complete local gate:

```powershell
npm ci
npx playwright install chromium webkit
npm run check
npm run test:browser
```

Browser tests rebuild production/preview bundles. Fixtures simulate SDK RPC/queue flags and draw real Hanzi Writer medians: engine/data/UI coverage, not human penmanship or physical stylus validation. Preview serves loopback port 8081; developer loading uses 8080. Harnesses, logs, screenshots and local evidence are excluded from the upload.

The recorded audio-fallback validation passed TypeScript, **174 unit/component tests** and **20 targeted desktop Chromium/phone WebKit import/editing cases**. These counts describe that earlier feature check, not the current full release suite; current release results belong in [CHANGELOG.md](CHANGELOG.md). All 72 distinct primary URLs in the selected-list/default-reading audit passed audio HEAD checks. Live playback through the actual playback function completed for the MOE MP3 sample in both engines and Shtooka Ogg/FLAC samples in Chromium. Windows WebKit rejects Ogg and stalls on the FLAC sample despite reporting FLAC support; this remains unresolved in that runner. [Playwright documents platform-specific codec differences](https://playwright.dev/docs/browsers#webkit), so physical Safari/RemNote playback acceptance is still required. Local structured results remain under ignored `audit/` paths.

Packaging checks manifest/root bundles, licenses, dictionary checksum, recording-index size/attribution, grouped character contents, version agreement and ZIP extraction. ZIP timestamps are fixed. Groups cover 64 code points: `(codePoint >>> 6).toString(16)`. The loader has explicit timeout/failure and no default CDN fallback. No runtime JavaScript CDN is used. React 17.0.2 follows the pinned SDK peer contract.

Compact/Beautiful Queue layouts size the full host wrapper chain, reserve native controls and use the largest fitting square. Scoring details open separately. Rules are scoped to plugin reviews; future RemNote DOM changes remain a compatibility risk.

Remaining acceptance: live RemNote 0.4.1 list practice/editing, physical iPhone/iPad/Pencil/finger/palm, VoiceOver/Dynamic Type, microphone permissions, cold offline startup and concurrent-device writes. Phone-sized WebKit is not physical iOS acceptance. The changelog distinguishes local checks, host acceptance and publication.

## Deferred expansion

CC-CEDICT defaults and recording links are implemented above. Curated gloss/sense selection and readiness changes remain future work. Other future work includes audited Taiwan overrides, a durable review-result outbox/conflict strategy, real export fixtures and optional validated speech assessment. No speech synthesis service/model has been configured, installed or tested on the user's voice.

The October 19–21, 2026 investigation retained these speech candidates; recheck capabilities/licenses before adoption:

| Candidate | Recorded finding and constraint |
| --- | --- |
| [Azure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment) | Listed zh-TW assessment; requires backend credentials, deliberate clip consent and learner/Taiwan evaluation. Accuracy is not established tone correctness. |
| [ASRT](https://github.com/nl8590687/ASRT_SpeechRecognition) | GPL-3.0 acoustic tonal-pinyin baseline; local-service/learner validation needed. Preserve raw acoustic labels instead of converting final Hanzi to dictionary tones. |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 runtime; examined browser example used about 199 MB models + 10 MB WASM. Separate assessment/model-license review needed. |
| [Mandarin Speech Coach](https://github.com/anton-dergunov/mandarin-speech-coach) | MIT alpha Whisper/wav2vec/Praat alignment and pitch prototype; model licenses and calibrated thresholds remain separate. |
| [Tone visualizer](https://github.com/Globexix/mandarin-tone-visualizer) | MIT client-side pitch evidence; does not establish consonant/vowel correctness. |
| [oral_pronunciation_assessment](https://github.com/FeisalDy/oral_pronunciation_assessment) | No explicit license found; do not vendor. Hand-set splitting/pitch rules did not establish a validated grade. |
| [OMPAL](https://github.com/phantomhsieh/OMPAL-corpus) | CC BY 4.0 evaluation corpus: 82 native and 1,768 French-L1 utterances; broader/Taiwan generalization unproven. |

Future assessment must reject unusable clips as uncertain, compare phonetic syllables rather than homophone characters, measure acoustic tones separately, handle sandhi/Taiwan variants and calibrate against teacher-labelled learner speech before suggesting grades. Browser transcription/dictionary pinyin alone is insufficient. English GOP models for Mandarin speakers are not Mandarin learner graders.

## Licenses and documentation policy

Code, Hanzi Writer and pinyin-pro are MIT; character vectors use Arphic. CC-CEDICT is CC BY-SA 4.0; MOE-derived records retain CC BY-ND 3.0 TW attribution. Full dependency notices/licenses ship in the ZIP.

Update this README when behavior or constraints change. Append dated release/verification facts only to [CHANGELOG.md](CHANGELOG.md). Do not recreate separate progress, proposal, evidence or roadmap Markdown files. Source: [hanzi-mastery](https://github.com/j5cfk7qm49-web/hanzi-mastery).
