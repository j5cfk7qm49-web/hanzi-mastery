# iOS and iPadOS layout

The intended phone workflow is portrait: read the prompt, begin, write in a square canvas, then choose a rating with RemNote's native controls. The plugin is an auto-sized review widget inside a host pane. Phone screen dimensions alone do not establish how much space the widget receives.

## Implemented in v0.2.2

- One column follows the widget's actual width, including a narrow iPad pane. The canvas remains square, respects the configured size cap and reserves its border instead of distorting the SVG with CSS.
- Sixteen CSS pixels on each side of the canvas remain available for scrolling, in addition to outer widget padding. Drawing suppresses gestures only on the canvas; the margins allow vertical panning. The visible hint explains where to swipe. Physical gesture routing in RemNote iOS still needs a device test.
- A compact header, mastery requirement and first-attempt score precede the canvas. **Forgot a stroke** and **Accidental input** sit directly below it in two columns. The accessible names still explain that forgetting ends the test. Less frequent practice/scoring options are in a disclosure.
- Controls have at least 44 by 44 CSS pixel targets. Input/select/textarea text is 16px. Long English prompts wrap without horizontal page scrolling. Zoom is not disabled.
- The original result stays visible during practice. Save status appears near the result heading, before the advisory grade selector. Long multi-character result lists can be expanded separately.
- Normal browser scrolling brings the canvas and its primary controls into view. Touch, pointer, mouse or wheel input cancels the delayed adjustment so it cannot move the surface under an active contact. Resize updates skip unchanged dimensions and retain accepted strokes/errors.
- Outer padding uses `max(normal padding, env(safe-area-inset-…))`. In an iframe WebKit may report zero insets because the host already handles them; the plugin cannot establish the native app's safe-area policy. It adds no fixed bottom toolbar or overlay over RemNote's controls.

The 44 CSS pixel target is a web design choice informed by Apple's 44-point touch guidance; it is not a claim of native UIKit conformance. Safe-area treatment follows WebKit's documented `viewport-fit`/`env()` approach. See [Apple UI design guidance](https://developer.apple.com/design/tips/), [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout), [WebKit safe-area documentation](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) and [RemNote widgets](https://plugins.remnote.com/advanced/widgets).

## Automated layout coverage

`npm run test:browser` includes a test-only parent queue pane with an auto-sized iframe and separate simulated native controls. It is a geometry/scrolling model, not a copy of RemNote's iOS interface. Height synchronization settles before geometry assertions, preventing a short stale iframe from making clipped content appear to pass. The fixture and its controls are excluded from the upload ZIP.

| Scenario | CSS viewport / pane | Checks |
| --- | --- | --- |
| Small phone | 320 × 568 | Square canvas at least 240px wide, reachable primary controls, no horizontal overflow |
| iPhone SE size | 375 × 667 | Same layout inside a limited review area |
| Large phone, dark | 430 × 932 | Dark colors, long prompts, canvas and controls |
| Phone landscape | 844 × 390 | Scroll to controls without shrinking the canvas into a tiny square |
| Tablet | 768 × 1024 | Centered layout and intact native-control space |
| Narrow tablet pane | 320px pane in 1024 × 768 | Layout responds to frame width rather than outer screen width |

Both Chromium and phone-configured WebKit run these cases, plus rotation with a recorded stroke, early reveal/results/practice, and synthetic enlarged text. Screenshot review supplements bounds checks. Generated images are in ignored `test-results/`. Enlarged text is a reflow stress test, not a verification of iOS Dynamic Type.

## Device validation still required

Portrait is the recommended phone orientation. A short landscape queue may not show the whole canvas and controls together; use the scroll margins or rotate to portrait. The plugin does not take over RemNote's review screen. On iPad, `canvasSize` can be increased for more writing room; smaller panes still constrain it by width.

Real RemNote iOS/iPadOS, safe-area propagation, finger/Pencil input, palm rejection, software-keyboard behavior in the workbench, VoiceOver, Dynamic Type, orientation changes during a contact, app suspension and save recovery remain unverified. WebKit emulation cannot certify those behaviors. Hosted plugin installation is also required for practical iOS use; a phone's localhost is not this computer's development server. See [installation](INSTALLATION.md) and [verification boundaries](TESTING.md).
