// WidgetOptions only accepts a numeric height. Bound the actual host iframe to
// the window as well, so a short desktop window cannot clip its scroll surface.
export const POPUP_HOST_CSS = `
iframe[data-plugin-id="hanzi_mastery_handwriting_v1"]:is([src*="widgetName=study_packs"], [src*="widgetName=workbench"]) {
  height: min(760px, 85vh) !important;
  height: min(760px, 85dvh) !important;
  max-height: 85vh !important;
  max-height: 85dvh !important;
}
`;
