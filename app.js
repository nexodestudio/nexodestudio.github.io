(() => {
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
  const socialBar = document.querySelector(".social-bar");

  if (!panel) return;

  const isMobileViewport = () =>
    window.matchMedia("(hover: none) and (pointer: coarse), (max-width: 768px)").matches;

  let isLockedOpen = false;
  let isHovered = false;

  // Estado para deslizar hacia la izquierda en móvil
  let isDragging = false;
  let startX = 0;
  let currentOffsetX = 0;

  function syncUI() {
    const mobile = isMobileViewport();
    const shouldShowSocial = isLockedOpen || (!mobile && isHovered);

    panel.classList.toggle("is-locked", isLockedOpen);
    panel.classList.toggle("is-open", mobile && isLockedOpen);
    document.body.classList.toggle("panel-open", shouldShowSocial);

    if (toggleBtn) {
      toggleBtn.classList.toggle("is-hidden", isLockedOpen);
      toggleBtn.setAttribute("aria-expanded", String(isLockedOpen));
    }
  }

  // En PC: al abrir el panel (hover o clic en él), se queda bloqueado abierto
  panel.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch" || isMobileViewport()) return;
    isHovered = true;
    isLockedOpen = true;
    syncUI();
  });

  panel.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch" || isMobileViewport()) return;
    isHovered = false;
    syncUI();
  });

  panel.addEventListener("click", () => {
    if (!isLockedOpen) {
      isLockedOpen = true;
      syncUI();
    }
  });

  // Botón cúbico en móvil abre el panel completo
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isLockedOpen = !isLockedOpen;
      syncUI();
    });
  }

  // Deslizar hacia la izquierda en móvil para cerrar el panel extendido
  panel.addEventListener("touchstart", (e) => {
    if (!isMobileViewport() || !isLockedOpen || e.touches.length !== 1) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    currentOffsetX = 0;
    panel.classList.add("is-dragging");
  }, { passive: true });

  panel.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    // Solo permitimos arrastrar hacia la izquierda (valores negativos)
    currentOffsetX = Math.min(0, dx);
    panel.style.transform = `translateX(${currentOffsetX}px)`;
  }, { passive: true });

  function finishTouchDrag() {
    if (!isDragging) return;
    isDragging = false;
    panel.classList.remove("is-dragging");

    const closeThreshold = Math.min(90, window.innerWidth * 0.22);
    const shouldClose = Math.abs(currentOffsetX) >= closeThreshold;

    panel.style.transform = "";
    currentOffsetX = 0;

    if (shouldClose) {
      isLockedOpen = false;
      isHovered = false;
      syncUI();
    }
  }

  panel.addEventListener("touchend", finishTouchDrag);
  panel.addEventListener("touchcancel", finishTouchDrag);

  // Cerrar solo al hacer clic/toque fuera del panel y fuera de los botones sociales
  document.addEventListener("pointerdown", (e) => {
    if (!isLockedOpen) return;
    const clickedInsidePanel = panel.contains(e.target);
    const clickedToggle = toggleBtn && toggleBtn.contains(e.target);
    const clickedSocial = socialBar && socialBar.contains(e.target);

    if (!clickedInsidePanel && !clickedToggle && !clickedSocial) {
      isLockedOpen = false;
      isHovered = false;
      syncUI();
    }
  });

  window.addEventListener("resize", () => {
    panel.style.transform = "";
    syncUI();
  });
  syncUI();
})();
