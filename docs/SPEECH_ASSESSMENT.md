# Mandarin speech recognition and learner assessment

Research checked 2026-10-19. This records the earlier investigation into automatic spoken-pronunciation assessment. That requirement has since been dropped from the current scope; pinyin recall, tone knowledge, listening and self-assessed spoken practice remain relevant. The candidate engines below are retained for reference.

## What the current increment provides

Pinyin and dictionary-tone answers are checked directly. Listening asks for dictionary pinyin after reference playback. Spoken practice records/plays a local clip and labels its outcome **self-assessed**. Automatic speech grading is outside the current requirements. No speech-recognition model is bundled, and no voice recording is uploaded by the plugin.

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
