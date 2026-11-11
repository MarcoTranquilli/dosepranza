/**
 * DosePranza - Kitchen Display & Prep Checklist (Zero-deps, fail-safe)
 */
(function() {
  const getTodayKey = () => "dosepranza_prep_" + new Date().toISOString().slice(0, 10);

  function getPrepState() {
    try {
      return JSON.parse(localStorage.getItem(getTodayKey()) || "{}");
    } catch (_) { return {}; }
  }

  function setOrderPrepared(orderId, isDone) {
    try {
      const state = getPrepState();
      if (isDone) state[orderId] = true;
      else delete state[orderId];
      localStorage.setItem(getTodayKey(), JSON.stringify(state));
    } catch (_) {}
  }

  function applyPrepStyles() {
    const state = getPrepState();
    const rows = document.querySelectorAll("tr[data-order-id], .order-card, tbody tr");
    rows.forEach(row => {
      const id = row.getAttribute("data-order-id") || row.id || row.querySelector("span")?.textContent?.trim();
      if (!id) return;
      
      const isDone = Boolean(state[id]);
      if (isDone) {
        row.classList.add("order-prepared");
      } else {
        row.classList.remove("order-prepared");
      }

      if (!row.querySelector(".prep-toggle-btn")) {
        const actionCell = row.querySelector("td:last-child") || row;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "prep-toggle-btn";
        btn.setAttribute("aria-label", "Segna comanda come pronta");
        btn.innerHTML = isDone ? "✓ Pronta" : "◯ Da fare";
        btn.onclick = (e) => {
          e.stopPropagation();
          const next = !row.classList.contains("order-prepared");
          setOrderPrepared(id, next);
          row.classList.toggle("order-prepared", next);
          btn.innerHTML = next ? "✓ Pronta" : "◯ Da fare";
          if (navigator.vibrate) { try { navigator.vibrate(15); } catch(_) {} }
        };
        actionCell.appendChild(btn);
      }
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { getPrepState, setOrderPrepared };
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      applyPrepStyles();
      const observer = new MutationObserver(() => applyPrepStyles());
      const target = document.querySelector("tbody") || document.body;
      observer.observe(target, { childList: true, subtree: true });
    });
  }
})();
