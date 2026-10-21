// Scope host layout changes to this plugin's handwriting iframe in the current card.
// The native answer/rating controls are outside rn-queue__content and remain untouched.
const frame = 'iframe[data-plugin-id="hanzi_mastery_handwriting_v1"][src*="widgetName=hanzi_review"]';
const content = `.rn-queue__content:has(${frame})`;
const queue = `.rn-queue:has(${frame})`;
export const REVIEW_HOST_CSS = `
${queue} .width-container-scroller:has(${frame}) {
  min-height: 0 !important;
  overflow: hidden !important;
  scrollbar-gutter: auto !important;
}
${content} {
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
}
/* Every wrapper on the path must shrink/grow, including Beautiful Queue's
   insight layout, scroll stage and card-content wrappers. A percentage height
   below an unsized wrapper otherwise falls back to the iframe's 150px default. */
${content} div:has(${frame}) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  gap: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
/* In writing cards, show just our interface throughout the content branch.
   This removes repeated native prompts, breadcrumbs and optional statistics /
   insight widgets at either nesting depth. Native rating controls live outside
   rn-queue__content and are deliberately excluded. */
${content} > :not(:has(${frame})):not(${frame}),
${content} div:has(${frame}) > :not(:has(${frame})):not(${frame}) {
  display: none !important;
}
${content} .beautiful-queue-insights-scroll-anchor,
${content} .beautiful-queue-card-free-space,
${content} .beautiful-queue-bottom-fade-spacer,
${queue} .beautiful-queue-bottom-fade-mask {
  display: none !important;
}
/* Beautiful Queue overlays native answer/rating controls inside the card.
   Put that same control group in normal flow so its real height is reserved. */
${queue} .beautiful-queue-bottom-controls-overlay {
  position: relative !important;
  flex: 0 0 auto !important;
}
${content} ${frame} {
  flex: 1 1 0% !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
}
`;
