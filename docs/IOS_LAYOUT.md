# iPhone and iPad writing layout

Version 0.3.4 gives the handwriting square the largest size that fits the available review area. It uses one compact prompt/status bar and 44px controls; scoring explanations and advisory rating choices open in a separate details sheet. Ready, test, saved result and guided practice fit without scrolling in the covered sizes. The optional details body can scroll.

The review remains a FlashcardUnder widget. Scoped host CSS matches only `iframe[data-plugin-id="hanzi_mastery_handwriting_v1"][src*="widgetName=hanzi_review"]` inside the current queue card. It hides that card's duplicate native question/answer and removes padding around this writing iframe. Native Show Answer and rating controls remain outside that content area. Other plugins and ordinary cards are not matched. The plugin supplies the English prompt and reveals the target only after testing or in guided practice. This integration depends on observed RemNote queue classes; future host markup changes may require maintenance. See [RemNote CSS integration](https://plugins.remnote.com/custom-css).

The iframe fills the available card space, with a 400px fallback registration height. Its internal layout uses the actual frame height, and the canvas measures both available width and height. Fitted reviews ignore the workbench's 320px default cap. Portrait uses stacked prompt/canvas/controls; wider frames put prompt and controls beside the square. Resizing updates Hanzi Writer dimensions without discarding accepted strokes or errors. Opening details pauses input and resumes the recorded prefix; Escape/Close restores focus. Workbench/document canvases retain their configured cap and scroll hint.

RemNote's `.dark` theme is respected even when the WebView's OS color preference differs. The writing paper stays light for stroke contrast. The host provides the device safe area; the iframe adds no overlay over native rating controls. Zoom remains enabled. Prompt display is capped at two lines to preserve writing space; the complete prompt is available in Review details.

## Automated coverage

Both Chromium and phone-configured WebKit exercise:

| Case | CSS viewport / pane |
| --- | --- |
| Compact phone | 320 × 568 |
| iPhone SE size | 375 × 667 |
| Supplied screenshot size | 393 × 852 |
| Large phone, dark | 430 × 932 |
| Landscape | 844 × 390 |
| Tablet | 768 × 1024 |
| Narrow split pane | 320px pane in 1024 × 768 |

Checks require the iframe and parent pane to have no scroll overflow, every visible main action to remain inside the frame with a minimum 44px target, and the square to fill the smaller available dimension. They also cover native reveal/rating space, details/rotation with an accepted stroke, enlarged text, and unrelated-plugin CSS isolation. Generated screenshots supplement geometry checks. The fixture uses observed host structure and simulated native controls; it is not the native iOS app. Enlarged text is a reflow stress test, not verification of Dynamic Type.

## Device status

The user confirmed that reinstalling restored handwriting on their iPhone before this redesign. Earlier versions fixed reproducible API-contract/startup bugs, but the phone's original internal failure was not inspected directly. The new layout still needs acceptance in the physical app. Safe-area propagation, finger/Pencil input, palm rejection, VoiceOver, Dynamic Type, orientation during contact, app suspension and save recovery remain device-test items. Hosted installation is required for phone use; the phone's localhost does not point to the computer's development server. See [installation](INSTALLATION.md) and [verification](TESTING.md).
