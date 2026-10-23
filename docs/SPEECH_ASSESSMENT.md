# Mandarin speech recognition and learner assessment

Feasibility refreshed 2026-10-21 after the user asked to explore independent assessment as well as simple reference comparison. The original open-source source audit below dates to 2026-10-19. Automatic pronunciation assessment is exploratory; it is not bundled or claimed as implemented.

## What the current increment provides

Pinyin and dictionary-tone answers are checked directly. Pinyin-to-character recognition checks the selected form against a vocabulary-derived, unambiguous option set. Listening asks for dictionary pinyin after reference playback. Spoken practice defaults to saying the word, playing the reference and explicitly **self-assessing**. Optional local recording/file playback remains available. No speech-recognition model is bundled, and no voice recording is uploaded by the plugin.

## Current feasibility decision

| Approach | Verified capability | Decision for this release |
| --- | --- | --- |
| Reference comparison | An HTTPS recording or an available local Mandarin voice already plays in the widget. | Implemented without mandatory recording. It works without microphone access and preserves explicit self-assessment. |
| Azure Pronunciation Assessment | Microsoft lists both `zh-CN` and **`zh-TW` Taiwanese Mandarin** among supported assessment locales. | A practical optional cloud-assessment candidate, requiring a configured Speech resource, service authentication and real recordings before integration can be accepted. It is not configured or exercised here. |
| Browser SpeechRecognition | MDN documents limited browser availability and that some implementations send audio to a service. | Do not use transcription as a pronunciation grade. It does not supply the acoustic tone evidence this task needs. |
| Browser-local sherpa-onnx | The official WASM example performs Chinese/English transcription; its illustrated build includes about 199 MB of model data and 10 MB of WASM. | Browser ASR is feasible, but this example adds substantial payload and still needs a separate learner-assessment layer. It is not a ready Mandarin tone grader. |

Sources checked: [Azure assessment locales](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment), [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [official sherpa-onnx WASM build](https://k2-fsa.github.io/sherpa/onnx/wasm/build.html).

Azure's [assessment documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment) describes pronunciation accuracy and fluency scores. Phoneme names are documented for `en-US` and `zh-CN`, whereas prosody assessment is `en-US` only. These capabilities do not establish a separate Taiwanese Mandarin tone-correctness score; that would require empirical evaluation. An initial integration should show service feedback separately from the learner's rating, retaining an uncertain result rather than inventing a pass threshold.

A concrete service trial would keep credentials in a server/helper, accept an explicitly selected clip, and request `zh-TW` pronunciation assessment. The [short-audio REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short) requires authentication, supports 16 kHz mono PCM WAV or OGG/Opus, and limits assessment input to 30 seconds. Browser recordings need conversion or SDK capture. Testing must include silence, incorrect tones, initial/final substitutions, homophones and Taiwan variants before using results to recommend a native grade. A configured resource and learner-speech samples are prerequisites; no service was provisioned or audio uploaded during this update.

## Candidate dependencies and prototypes

| Project | Verified capabilities | Fit and limitations |
| --- | --- | --- |
| [ASRT](https://github.com/nl8590687/ASRT_SpeechRecognition), [acoustic prediction](https://github.com/nl8590687/ASRT_SpeechRecognition/blob/master/predict_speech_file.py), [labels](https://github.com/nl8590687/ASRT_SpeechRecognition/blob/master/dict.txt) | GPL-3.0. Acoustic DCNN/CTC outputs tonal pinyin before a separate pinyin-to-Hanzi language model. Source labels include `ren2`, `ren3`, `ren4`, `ma1`–`ma5`; pre-trained server releases are available. | Particularly relevant for directly checking the spoken syllable/tone without relying on inferred Hanzi. Python/TensorFlow local-server candidate, not a drop-in widget. README reports about 85% pinyin accuracy on its test set and a 16-second input limit; learner/Taiwanese error detection has not been validated. |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), [browser support](https://k2-fsa.github.io/sherpa/onnx/wasm/index.html) | Apache-2.0 runtime; offline recognition; Chinese/English browser examples, native and Node integrations. | Strong ASR engine candidate. Recognition text is not a pronunciation score. Model licenses, download size, WebView memory and microphone access must be checked separately. |
| [Mandarin Speech Coach](https://github.com/anton-dergunov/mandarin-speech-coach) | Declares MIT in pyproject.toml. Whisper transcription, Chinese wav2vec2 CTC character alignment, Praat/Parselmouth pitch extraction; optional Montreal Forced Aligner. | Useful local-backend prototype for intelligibility plus per-syllable acoustic evidence. It describes itself as alpha and visualizes evidence rather than providing a validated pass/fail score. Default models are whisper-small and jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn, with separate model licenses. |
| [Mandarin tone visualizer](https://github.com/Globexix/mandarin-tone-visualizer) | Explicit MIT license. Client-side Web Audio recording/upload, offline pitch extraction, vowel-segment selection, octave-error smoothing and contour comparison. | Small browser-side starting point for isolated tone feedback. It cannot establish that the intended consonant/vowel was spoken. No learner-validation claim adopted. |
| [oral_pronunciation_assessment](https://github.com/FeisalDy/oral_pronunciation_assessment) | Local faster-whisper base/int8 transcription plus Parselmouth pitch; 1–4 syllables; basic tone sandhi. | Closest minimal learner-evaluation demo, but no explicit license found in the repository tree/API metadata. Source inspection shows silence-based splitting and hand-set pitch/duration/intensity rules, not a trained pronunciation assessor. Do not vendor it or trust its combined score as a grade. |
| [OMPAL](https://github.com/phantomhsieh/OMPAL-corpus) | CC-BY-4.0 Mandarin learner corpus: 82 native and 1,768 French-L1 learner utterances; teacher annotations include tones, consonants and vowels. | Evaluation/training material, not an inference library. Useful for checking agreement with teachers; coverage does not establish generalization to all learners or Taiwanese pronunciation. |

## Proposed automatic assessment architecture

1. Capture one deliberate speech attempt. Reject silence/poor-quality or unalignable clips as **unable to assess**, with no invented score.
2. Run Mandarin ASR without feeding it the answer as a recognition hint. Keep the transcript and confidence as evidence of intelligibility.
3. Compare phonetic readings, not exact characters. **人 and 仁 are both rén**: a recognizer choosing 人 when the card says 仁 must not itself cause a failure. Polyphonic words require context-aware readings, with separate spelling and pronunciation objectives.
4. Align syllables and evaluate acoustic tones separately from the Hanzi-to-pinyin transcription. Converting a recognized character to pinyin only returns its dictionary tone; it does not measure the tone actually spoken.
5. Handle third-tone sandhi, 一/不 changes, neutral tone, half-third tone, and accepted Taiwanese variants explicitly. Do not assume isolated citation contours are the only correct connected-speech realizations.
6. Show separate evidence for recognition, syllable/phoneme matching and tone estimates. Calibrate pass/fail thresholds on teacher-labelled learner samples before allowing automatic mastery promotion. Keep an uncertain outcome and a user override.

Start with isolated syllables/short words and benchmark correct recordings against deliberately incorrect tones and initial/final substitutions. **Evaluate ASRT's raw tonal-pinyin output as a phonetic baseline**, sherpa-onnx as the portable recognition runtime, and the alignment/pitch pipeline for additional tone evidence. ASRT's pinyin labels are acoustically predicted; taking its final Hanzi and converting those back to dictionary pinyin would discard that distinction. An initial objective result should be “recognized ren2 / expected ren2,” “tone mismatch,” or “uncertain,” rather than an uncalibrated native-like pronunciation score.

A local desktop helper can run heavier models; browser WASM inference is a separate mobile feasibility experiment. The native plugin must retain RemNote's scheduling and rating controls. A stored per-card reference recording is useful for listening and imitation, but is not required to compare an acoustic recognizer's output with the card's expected pinyin.

## References and scope

- [Chinese Guru's modules](https://www.xamisoft.com/en/chinese_guru#learning): tone tracing and pronunciation from pinyin/zhuyin are advertised; a validated automatic spoken-pronunciation grader was not established by the publisher page.
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper): transcription runtime, not a learner pronunciation grade.
- [getUserMedia requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): embedded microphone access depends on host delegation and user permission.
- [Kaldi GOP example](https://github.com/kaldi-asr/kaldi/blob/master/egs/gop_speechocean762/README.md): the familiar SpeechOcean762 recipe evaluates **English spoken by Mandarin speakers**, not Mandarin spoken by learners. Do not present that model as a ready Mandarin grader.

Source inspection and documentation review are complete; none of these speech models has been installed or evaluated on this user's voice.
