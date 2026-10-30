# Pronunciation metadata

`shtooka-index.json.gz` contains word, reading and file-ID metadata from the University of Caen / Shtooka Mandarin collection, not audio recordings.

Copyright (c) 2009 Yue Tan. Licence: Creative Commons Attribution-ShareAlike 3.0 United States, https://creativecommons.org/licenses/by-sa/3.0/us/ . This compact index is an adaptation of the original metadata and is distributed under that licence.

Preserved source: https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/flac/index.tags.txt
Original collection notice: https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/readme.txt
Recording host: https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/ogg/

Rebuild explicitly with `node scripts/build-audio-index.mjs <downloaded index.tags.txt>`. The source SHA256 is recorded inside the generated index. Normal builds do not fetch source data. The original server's metadata endpoint does not provide browser CORS headers, so this small index is served with the plugin. Matches prefer exact written forms and approved base-radical aliases. Isolated-character cards can reuse an intact, single-character recording with the same explicit syllable and tone. Audio bytes load on playback; word recordings are never assembled from syllable clips.

For browsers reporting FLAC support without Ogg Vorbis support, playback uses the collection's same-ID file from `https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/flac/`. Both formats retain the same speaker, collection and licence attribution.

Wikimedia fallback uses the Mandarin pronunciation attached to the exact Chinese Wiktionary entry. Each selected Commons recording retains its own author, source URL and licence; a dictionary text licence is not substituted for the recording's licence. No Wikimedia recording inventory or audio bytes are bundled.

## Ministry of Education Concise Dictionary

`moe-index.json.gz` is a factual routing index of 6,472 supported single-character audio IDs, written forms and explicitly supplied readings. It joins the unchanged official text workbook and single-character audio-index workbook, snapshot **2014_20260929**. No official English translation, edited definition or modified audio is supplied.

Author and source: 中華民國教育部《國語辭典簡編本》 (Ministry of Education, R.O.C.). Official downloads and terms: https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html

Audio licence: Creative Commons Attribution-NoDerivs 3.0 Taiwan, https://creativecommons.org/licenses/by-nd/3.0/tw/ . Use complete original recordings with attribution. The original `MOE-CONCISE-USAGE-NOTICE.pdf` is included unchanged. The single-character `sound/word/<ID>.mp3` files are linked from the official dictionary server; full-entry `sound/mean/` narration is not used.

Rebuild explicitly with `python scripts/build-moe-audio-index.py <official text ZIP> <official single-character audio-index XLSX>`. Source SHA256 values:

- Text ZIP: `5bab99dac44ad7a6ccdcf481e770e8aca05ede7445c4cc25b8199e0e5df64cf2`
- Audio-index XLSX: `79841c547331304097ea239fd1f314acca310396b9a6535e6741a408c8af696e`
- Compressed routing index: `8e20950146110d1fa2dfda7833bac4aef15dfacac938fc2146675a6de6ac9cb8`

The routing index is 36,093 bytes. No MOE audio archive is bundled or downloaded during builds. Each saved match preserves the actual recorded form, source link, author/version and licence separately from the learner's target and English study wording.

## Tone Perfect

No Tone Perfect audio or inventory is distributed. Its creators document educational/noncommercial restrictions and approved bulk access, and current redistribution permission has not been established. MOE is used for gaps after the existing providers; Tone Perfect remains disconnected pending approved access and applicable reuse terms. It was not needed for the checked Chinese Guru readings.
