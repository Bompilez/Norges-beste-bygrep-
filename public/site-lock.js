const siteLockPasswordHash = "1f6663b7dcc33b1b21b3a53dadaaab7d640313af9c324fad88431aa40b2cf6ba";
const siteLockStorageKey = "bygrepSiteUnlocked";

if (sessionStorage.getItem(siteLockStorageKey) === "true") {
    unlockSite();
} else {
    window.addEventListener("DOMContentLoaded", showSiteLock);
}

async function showSiteLock() {
    const lock = document.createElement("div");
    lock.className = "site-lock";
    lock.setAttribute("role", "dialog");
    lock.setAttribute("aria-modal", "true");
    lock.setAttribute("aria-labelledby", "site-lock-title");
    lock.setAttribute("aria-describedby", "site-lock-description");

    const panel = document.createElement("form");
    panel.className = "site-lock-panel";

    const title = document.createElement("h1");
    title.id = "site-lock-title";
    title.textContent = "Siden er ikke publisert enda..";

    const text = document.createElement("p");
    text.id = "site-lock-description";
    text.textContent = "Skriv inn passordet for å få tilgang.";

    const label = document.createElement("label");
    label.setAttribute("for", "site-lock-password");
    label.textContent = "Passord";

    const input = document.createElement("input");
    input.id = "site-lock-password";
    input.type = "password";
    input.autocomplete = "current-password";
    input.setAttribute("aria-describedby", "site-lock-error");
    input.required = true;

    const error = document.createElement("p");
    error.id = "site-lock-error";
    error.className = "site-lock-error";
    error.setAttribute("aria-live", "polite");

    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Gå inn";

    panel.append(title, text, label, input, error, button);
    lock.append(panel);
    document.body.append(lock);
    input.focus();

    panel.addEventListener("submit", async (event) => {
        event.preventDefault();

        const passwordHash = await sha256(input.value);
        if (passwordHash === siteLockPasswordHash) {
            sessionStorage.setItem(siteLockStorageKey, "true");
            unlockSite();
            lock.remove();
            return;
        }

        input.value = "";
        error.textContent = "Feil passord.";
        input.setAttribute("aria-invalid", "true");
        input.focus();
    });

    input.addEventListener("input", () => {
        input.removeAttribute("aria-invalid");
        error.textContent = "";
    });
}

function unlockSite() {
    document.documentElement.classList.remove("site-locked");
}

async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}
