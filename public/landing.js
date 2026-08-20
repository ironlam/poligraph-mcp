const tabs = [...document.querySelectorAll("[data-tab]")];
const panels = [...document.querySelectorAll("[data-panel]")];
const copyStatus = document.querySelector(".copy-status");

function activateTab(tab) {
  const selected = tab.dataset.tab;

  for (const candidate of tabs) {
    const isSelected = candidate === tab;
    candidate.classList.toggle("is-active", isSelected);
    candidate.setAttribute("aria-selected", String(isSelected));
    candidate.tabIndex = isSelected ? 0 : -1;
  }

  for (const panel of panels) {
    panel.hidden = panel.dataset.panel !== selected;
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const lastIndex = tabs.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    activateTab(nextTab);
    nextTab.focus();
  });
}

async function copyText(text) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(text);
}

for (const button of document.querySelectorAll("[data-copy-target]")) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    const text = target?.textContent?.trim();
    if (!text) {
      return;
    }

    const label = button.querySelector("span") ?? button;
    const originalLabel = label.textContent;

    try {
      await copyText(text);
      label.textContent = "Copié";
      if (copyStatus) {
        copyStatus.textContent = "Configuration copiée dans le presse-papiers.";
      }
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection?.removeAllRanges();
      selection?.addRange(range);
      label.textContent = "Sélectionné";
      if (copyStatus) {
        copyStatus.textContent = "Texte sélectionné, utilisez la commande de copie de votre appareil.";
      }
    }

    window.setTimeout(() => {
      label.textContent = originalLabel;
      if (copyStatus) {
        copyStatus.textContent = "";
      }
    }, 2200);
  });
}
