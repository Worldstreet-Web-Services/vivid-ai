export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "vb-theme";

/**
 * Inlined in <head> so the stored theme is applied before first paint,
 * avoiding a dark → light flash for returning visitors.
 */
export const themeInitScript = `(function(){var d=document.documentElement;try{d.dataset.theme=localStorage.getItem("${THEME_STORAGE_KEY}")==="light"?"light":"dark";}catch(e){d.dataset.theme="dark";}})();`;
