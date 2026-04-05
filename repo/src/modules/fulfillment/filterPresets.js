const PRESETS_KEY = "cfso_fulfillment_filter_presets";

export function loadFilterPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFilterPresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}
