# ChineseGuru and Pleco interoperability

For automatic vocabulary creation from a word list, use the workbench's [dictionary import](DICTIONARY_IMPORT.md). It queries MOE-derived readings through Moedict, matches English suggestions from the bundled CC-CEDICT snapshot, automatically imports editable vocabulary plus a bidirectional translation Rem, with optional preview. The file converters below remain separate CLI tools for preserving supplied export data.

## Verified boundaries

The current Chinese Guru publisher page, help page and App Store description were checked on 2026-10-16. They did not establish a documented machine-readable export schema, audio export, or review-history export. Older third-party descriptions mention list export, but that is insufficient evidence to promise a current format. No native ChineseGuru converter is claimed. A real export sample and its source/version are needed to implement and validate that adapter.

Pleco's official iOS manual documents text and XML exports. Text can contain headwords, pronunciation, permitted definitions and categories; XML can additionally contain statistics. Exportability of dictionary definitions depends on the dictionary. Select UTF-8 and **Traditional** or **Both**. Audio binary transfer is not established by this pathway. Review statistics are not imported into RemNote scheduling.

## Tested CLI

```powershell
npm run import -- --format pleco --input my-pleco.txt --output vocabulary.json --bare-script traditional --markdown vocabulary.md
npm run import -- --format csv --input normalized.csv --output vocabulary.json
npm run import -- --format csv --input export.csv --mapping columns.json --output vocabulary.json
```

The CLI refuses to overwrite files. Fixtures in `tests/fixtures` are **synthetic examples of documented formats**, not exports taken from a learner's Pleco/ChineseGuru account. No user export sample was supplied, so compatibility with a particular live export remains to be checked.

Pleco text supports `simplified[traditional]`, tab-separated pinyin/definition, and `//Category` headers. Unbracketed words require `--bare-script traditional`, declaring that the user exported Traditional. The tool cannot determine that automatically. Nested category paths are retained as strings. Duplicate vocabulary/pronunciation entries merge their categories and provenance. Distinct readings remain distinct entries. Tone information is retained exactly; it is not guessed or normalized into a different pronunciation.

Mapped CSV/TSV uses explicit headers: `traditional`, `simplified`, `pinyin`, `meanings`, `categories`, `source`, `partOfSpeech`, `audio`, `tocflLevel`, `tocflSource`, `tags`. Optional lists use semicolons. Map arbitrary headers with a JSON file such as `{"traditional":"Characters","meanings":"English"}`. This is a generic mapping facility, not a claim about ChineseGuru's export column names. Imported TOCFL labels are marked unverified. Unknown fields remain raw provenance and never become scheduling history.

JSON output is the canonical interchange artifact. Optional Markdown is plain vocabulary notes, without generated cards or hidden writing metadata. It can be inspected/imported as notes. Direct import of these converted files into the workbench is not implemented; the dictionary word-list importer is separate and creates bidirectional translations under character headings in a selected native list bullet. Use the workbench to create/link writing cards. XML history migration and automatic linking of arbitrary imported Rems are deferred. No converter calls the RemNote API or modifies a knowledge base.

Pleco dictionary links in guided practice use its documented iOS URL scheme. Opening that link depends on the host allowing external schemes and Pleco being installed; it has not been verified in RemNote iOS. Pleco does not control scheduling.

Primary references: [Chinese Guru publisher](https://www.xamisoft.com/en/chinese_guru), [help](https://www.xamisoft.com/en/chinese_guru/help), [App Store](https://apps.apple.com/us/app/chinese-guru/id1552540590), [Pleco current iOS export manual](https://iphone.pleco.com/manual/30200/flash.html), [documented text syntax](https://iphone.pleco.com/manual/220/flash.html), [Pleco URL scheme](https://iphone.pleco.com/manual/30200/vershist.html).
