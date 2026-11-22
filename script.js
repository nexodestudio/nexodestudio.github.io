(() => {
  const scene = document.getElementById("underwater-scene");
  const particlesContainer = document.getElementById("particles-layer");

  if (!scene) return;

  // Asignar profundidad (--depth) desde data-depth a cada capa
  const depthElements = scene.querySelectorAll("[data-depth]");
  depthElements.forEach((el) => {
    const depth = parseFloat(el.getAttribute("data-depth")) || 0.2;
    el.style.setProperty("--depth", depth);
  });

  // Parallax sutil siguiendo el puntero dentro del main
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  const maxOffset = 28; // píxeles máximos de desplazamiento base

  scene.addEventListener("pointermove", (e) => {
    const rect = scene.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 a 1
    const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 a 1

    targetX = normX * maxOffset;
    targetY = normY * maxOffset;
  });

  scene.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
  });

  function animateParallax() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    scene.style.setProperty("--px", `${currentX.toFixed(2)}px`);
    scene.style.setProperty("--py", `${currentY.toFixed(2)}px`);

    requestAnimationFrame(animateParallax);
  }

  requestAnimationFrame(animateParallax);

  // Generar burbujas/partículas ligeras subiendo hacia la superficie
  if (particlesContainer) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const bubble = document.createElement("span");
      bubble.className = "bubble";

      const size = 3 + Math.random() * 6;
      const left = Math.random() * 100;
      const duration = 9 + Math.random() * 10;
      const delay = -(Math.random() * duration);

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${left}%`;
      bubble.style.animationDuration = `${duration}s`;
      bubble.style.animationDelay = `${delay}s`;

      particlesContainer.appendChild(bubble);
    }
  }
})();
