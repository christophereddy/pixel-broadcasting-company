/* Company pages: fill in the plug-in spots from shared/business.js.
   <span data-email="press"></span>   an email link, or a COMING SOON tag while that address is empty
   <span data-company></span>         the company's name (the legal name once the LLC exists)
   <span data-address></span>         the mailing address, or COMING SOON */
(function(){
  "use strict";
  const B = window.PBC_BUSINESS || {};
  function soon(text){ const t = document.createElement("span"); t.className = "co-tag soon"; t.textContent = text || "COMING SOON"; return t; }
  function fill(){
    document.querySelectorAll("[data-email]").forEach(el => {
      const addr = ((B.email || {})[el.dataset.email] || B.email && B.email.general || "").trim();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
        const a = document.createElement("a"); a.href = "mailto:" + addr; a.textContent = addr; el.replaceChildren(a);
      } else el.replaceChildren(soon("EMAIL COMING SOON"));
    });
    document.querySelectorAll("[data-company]").forEach(el => { el.textContent = B.company || "Pixel Broadcasting Company"; });
    document.querySelectorAll("[data-address]").forEach(el => { if (B.mailingAddress) el.textContent = B.mailingAddress; else el.replaceChildren(soon()); });
  }
  window.PBC_COMPANY = { soon };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill); else fill();
})();
