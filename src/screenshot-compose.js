// F2 with the GUI: native ScreenShotHelper reads the whole framebuffer, so the HUD, chat and any open screen are in the PNG. Here the
// world is a WebGL canvas and the GUI is DOM, so the DOM is rasterised through an SVG foreignObject (the page's matching CSS rules,
// every image and the Minecraft font inlined as data urls, so the canvas stays untainted) and drawn over the canvas frame.
// Limits (browser-only): a WebGL canvas inside the DOM (the title panorama) comes out transparent, :hover and focus rings follow the
// live state, and the capture is taken a few milliseconds after the frame.
const URL_IN_CSS = /url\(\s*(["']?)(?!data:|#|blob:)([^"')]+)\1\s*\)/g;

// Replaces every non-data url() in `text` with the data url `toData(url)` resolves to (unresolvable ones are left out of the rule).
export async function inlineCssUrls(text, toData) {
  const found = new Set();
  text.replace(URL_IN_CSS, (_m, _q, u) => { found.add(u); return _m; });
  const done = new Map();
  await Promise.all([...found].map(async (u) => { try { done.set(u, await toData(u)); } catch { done.set(u, null); } }));
  return text.replace(URL_IN_CSS, (_m, _q, u) => (done.get(u) ? `url("${done.get(u)}")` : "none"));
}

// A selector as querySelector can test it: pseudo-elements are dropped (a ::before rule applies when its host exists).
export const hostSelector = (sel) => sel.replace(/::?(before|after|first-line|first-letter|selection|placeholder|-webkit-[\w-]+|-moz-[\w-]+)/g, "").trim() || "*";

const blobToData = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
export async function fetchDataUrl(url, fetchImpl = fetch) {
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(String(r.status));
  return blobToData(await r.blob());
}

// The CSS the visible page needs: every rule whose selector matches something now (media rules by matchMedia), @font-face rules.
function collectCss(doc, win) {
  const out = [];
  const walk = (rules) => {
    for (const rule of rules) {
      const T = rule.constructor.name;
      if (T === "CSSStyleRule") {
        let hit = false;
        try { hit = !!doc.querySelector(hostSelector(rule.selectorText)); } catch { hit = false; }
        if (hit) out.push(rule.cssText);
      } else if (T === "CSSFontFaceRule") out.push(rule.cssText);
      else if (T === "CSSMediaRule") { if (win.matchMedia(rule.conditionText || rule.media.mediaText).matches) walk(rule.cssRules); }
      else if (T === "CSSSupportsRule") walk(rule.cssRules);
    }
  };
  for (const sheet of doc.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ } }
  return out.join("\n");
}

// A deep copy of `root` for serialisation: scripts dropped, 2D canvases and <img> turned into data-url <img>s.
async function cloneTree(root, { skip, toData }) {
  const clone = root.cloneNode(true), jobs = [];
  const srcs = [...root.querySelectorAll("*")], dsts = [...clone.querySelectorAll("*")];
  srcs.forEach((el, i) => {
    const dst = dsts[i];
    if (skip?.(el) || el.tagName === "SCRIPT") { dst.remove(); return; }
    if (el.tagName === "CANVAS") {
      const img = dst.ownerDocument.createElement("img");
      for (const a of ["class", "id", "style"]) if (el.hasAttribute(a)) img.setAttribute(a, el.getAttribute(a));
      try { img.setAttribute("src", el.toDataURL("image/png")); } catch { /* tainted */ }
      img.setAttribute("width", el.clientWidth); img.setAttribute("height", el.clientHeight);
      dst.replaceWith(img);
    } else if (el.tagName === "IMG" && el.getAttribute("src") && !el.getAttribute("src").startsWith("data:")) {
      jobs.push(toData(el.currentSrc || el.src).then((d) => dst.setAttribute("src", d), () => dst.removeAttribute("src")));
    }
    if (el.getAttribute?.("style")?.includes("url(")) jobs.push(inlineCssUrls(el.getAttribute("style"), toData).then((s) => dst.setAttribute("style", s)));
    if (el.value !== undefined && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) dst.setAttribute("value", el.value);
  });
  await Promise.all(jobs);
  return clone;
}

// `frameBlob`: the canvas frame (PNG). Resolves to a PNG blob with the DOM drawn over it, or throws.
export async function composeWithDom(frameBlob, { doc = document, win = window, skip, fetchImpl = fetch } = {}) {
  const frame = await createImageBitmap(frameBlob), W = frame.width, H = frame.height, cw = win.innerWidth, ch = win.innerHeight;
  const cache = new Map(), toData = (u) => { const abs = new URL(u, win.location.href).href; if (!cache.has(abs)) cache.set(abs, fetchDataUrl(abs, fetchImpl)); return cache.get(abs); };
  const body = await cloneTree(doc.body, { skip, toData });
  const css = await inlineCssUrls(collectCss(doc, win), toData);
  const html = new XMLSerializer().serializeToString(body).replace(/^<body/, "<div").replace(/<\/body>$/, "</div>");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${cw} ${ch}"><foreignObject width="${cw}" height="${ch}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${cw}px;height:${ch}px;position:relative;overflow:hidden;font-family:Minecraft,monospace;color:#fff"><style>${css.replace(/<\/style/gi, "<\\/style")}</style>${html}</div></foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("DOM raster failed")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const canvas = doc.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d");
  g.drawImage(frame, 0, 0);
  g.drawImage(img, 0, 0, W, H);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no image data"))), "image/png"));
}
