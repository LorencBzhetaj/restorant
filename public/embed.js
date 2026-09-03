/**
 * Terrazza reservation widget — drop-in embed for any site (e.g. WordPress).
 *
 * Usage (paste where you want the widget to appear):
 *   <script src="https://YOUR-DOMAIN/embed.js" data-origin="https://YOUR-DOMAIN"></script>
 *
 * It inserts a responsive iframe pointing at /reserve and auto-resizes it to fit.
 */
(function () {
  var script = document.currentScript;
  var origin = (script && script.getAttribute("data-origin")) || window.location.origin;
  origin = origin.replace(/\/$/, "");

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/reserve";
  iframe.title = "Book a table";
  iframe.loading = "lazy";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.minHeight = "640px";
  iframe.style.height = "720px";
  iframe.style.overflow = "hidden";

  if (script && script.parentNode) {
    script.parentNode.insertBefore(iframe, script);
  } else {
    document.body.appendChild(iframe);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== origin) return;
    var d = e.data;
    if (d && d.type === "terrazza:resize" && typeof d.height === "number") {
      iframe.style.height = Math.max(d.height, 480) + "px";
    }
  });
})();
