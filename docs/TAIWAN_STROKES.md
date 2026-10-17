# Traditional characters and Taiwan stroke standards

Traditional is the default; Simplified requires an explicitly supplied form. No automatic script conversion is performed. All seven requested characters are embedded in the handwriting bundle, and 9,574 individual character assets are included in the upload package. Hanzi Writer's data derives from Make Me a Hanzi/Arphic fonts; a Taiwanese font origin does not establish MOE stroke-order compliance.

## Check performed 2026-10-16

The live MOE search results and per-character stroke diagrams were inspected against hanzi-writer-data 2.0.1. Stroke-count agreement is established for this set; **full order/shape compliance is not established**.

| Character | Bundled strokes | MOE strokes | Verification status |
| --- | --- | --- | --- |
| 學 | 16 | 16 | Concrete order difference: bundled data begins with the left-hand group, then the central crosses; MOE begins with the central crossed strokes. |
| 國 | 11 | 11 | Count checked; complete order/shape audit pending. |
| 書 | 10 | 10 | Count checked and diagram inspected; complete order/shape audit pending. |
| 語 | 14 | 14 | Count checked; complete order/shape audit pending. |
| 聽 | 22 | 22 | Count checked and diagram inspected; complete order/shape audit pending. |
| 體 | 23 | 23 | Count checked and diagram inspected; 骨 glyph/sequence needs detailed regional comparison. |
| 愛 | 13 | 13 | Count checked; complete order/shape audit pending. |

The shipped MVP retains the upstream sequences. Do not treat its rejection of an alternative Taiwanese sequence as proof that the learner is wrong. Use guided practice/reference comparison when a sequence disagrees. A visible notice is included before testing. Taiwan-specific vector/order packs are a high-priority follow-up, rather than an unsupported compliance claim.

## Override mechanism

`src/data/overrides.ts` defines a character-specific registry with:

- Replacement Hanzi Writer `{strokes, medians, radStrokes?}` data.
- Required source, license and explanation.
- Optional MOE audit date and recognizer leniency override.

Overrides take precedence over embedded/core and packaged data. They must preserve consistent stroke/median counts; the loader validates them. A factual order-only correction can reorder the existing Arphic-licensed stroke/median arrays together, with corresponding radical indices, without copying MOE vectors. Every such correction needs a per-stroke audit and engine regression test before shipping. The registry is empty in this release; no unverified permutations are silently applied.

The MOE animation page declares **CC BY-NC-ND 3.0 Taiwan**. No MOE animation/vector data is included in the repository or plugin. Do not assume that transforming their coordinates into a Hanzi Writer pack is permitted. Use licensed upstream vectors or obtain permission for a Taiwanese alternative. Private audit downloads are excluded from Git and packaging.

References: [MOE 學 entry](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=23416), [國](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=22283), [書](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=26360), [語](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=35486), [聽](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=32893), [體](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=39636), [愛](https://stroke-order.learningweb.moe.edu.tw/dictView.jsp?ID=24859), [MOE licensing](https://stroke-order.learningweb.moe.edu.tw/page.jsp?ID=52), [Hanzi Writer data licensing](https://github.com/chanind/hanzi-writer-data).
