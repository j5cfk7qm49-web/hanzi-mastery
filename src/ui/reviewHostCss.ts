// Scope host layout changes to this plugin's handwriting iframe in the current card.
// The native answer/rating controls are outside rn-queue__content and remain untouched.
const frame = 'iframe[data-plugin-id="hanzi_mastery_handwriting_v1"][src*="widgetName=hanzi_review"]';
const content = `.rn-queue__content:has(${frame})`;
export const REVIEW_HOST_CSS = `
.rn-queue .width-container-scroller:has(${frame}) {
  min-height: 0 !important;
  overflow: hidden !important;
}
${content} {
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
}
${content} > div:has(${frame}) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
${content} > div:has(${frame}) > :not(:has(${frame})) {
  display: none !important;
}
${content} > div:has(${frame}) > :has(${frame}),
${content} div:has(> ${frame}) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
${content} ${frame} {
  flex: 1 1 0% !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
}
`;
