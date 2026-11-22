(() => {
  /**
   * Resuelve una ruta relativa de forma dinámica respecto a la base actual
   * (funciona igual en local y en GitHub Pages, sin depender de C:\... ni de "main\").
   */
  function resolveAsset(relativePath) {
    return new URL(relativePath, document.baseURI).href;
  }

  function hydrateAssets(root = document) {
    const nodes = root.querySelectorAll("[data-asset]");
    nodes.forEach((el) => {
      const rel = el.getAttribute("data-asset");
      if (!rel) return;
      const resolvedUrl = resolveAsset(rel);

      if (el.tagName === "IMG" || el.tagName === "SCRIPT" || el.tagName === "SOURCE") {
        el.src = resolvedUrl;
      } else if (el.tagName === "LINK") {
        el.href = resolvedUrl;
      } else {
        el.style.setProperty("--asset-url", `url("${resolvedUrl}")`);
      }
    });
  }

  hydrateAssets(document);
  window.NullAssetResolver = { resolve: resolveAsset, hydrate: hydrateAssets };

  const canvas = document.getElementById("glcanvas");
  if (window.ShaderBackground && canvas) {
    window.ShaderBackground.init(canvas);
  }

  const toggleBtn = document.getElementById("cube-toggle");
  const panel = document.getElementById("side-panel");

  if (!panel) return;

  let isMobileOpen = false;
  let isDesktopHovered = false;

  function syncUI() {
    panel.classList.toggle("is-open", isMobileOpen);
    document.body.classList.toggle("panel-open", isMobileOpen || isDesktopHovered);

    if (toggleBtn) {
      toggleBtn.classList.toggle("is-hidden", isMobileOpen);
      toggleBtn.setAttribute("aria-expanded", String(isMobileOpen));
    }
  }

  panel.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch") return;
    isDesktopHovered = true;
    syncUI();
  });

  panel.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    isDesktopHovered = false;
    syncUI();
  });

  panel.addEventListener("focusin", () => {
    isDesktopHovered = true;
    syncUI();
  });

  panel.addEventListener("focusout", (e) => {
    if (!panel.contains(e.relatedTarget)) {
      isDesktopHovered = false;
      syncUI();
    }
  });

  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isMobileOpen = !isMobileOpen;
      syncUI();
    });
  }

  document.addEventListener("pointerdown", (e) => {
    if (!isMobileOpen) return;
    if (!panel.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
      isMobileOpen = false;
      syncUI();
    }
  });

  syncUI();
})();
