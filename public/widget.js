/*
 * Widget de chat de Senda Consultora.
 * Uso en cualquier sitio:
 *   <script src="https://TU-SERVIDOR/widget.js" defer
 *           data-title="Senda Consultora" data-color="#0f766e"></script>
 * Atributos opcionales: data-api (URL del servidor; por defecto, el origen de este script),
 * data-title, data-subtitle, data-color, data-greeting.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var ds = (script && script.dataset) || {};
  var API = (ds.api || (script ? new URL(script.src).origin : "")).replace(/\/$/, "");
  var TITLE = ds.title || "Senda Consultora";
  var SUBTITLE = ds.subtitle || "Asistente virtual · respondemos al instante";
  var COLOR = ds.color || "#0f766e";
  var GREETING =
    ds.greeting ||
    "¡Hola! 👋 Soy Senda, el asistente de Senda Consultora. Te ayudo con marketing, estrategia comercial, finanzas e inteligencia artificial. ¿En qué te puedo ayudar?";
  var SUGGESTIONS = [
    "Quiero conseguir más clientes",
    "Necesito ayuda con publicidad online",
    "Quiero ordenar las finanzas",
    "¿Cómo puede ayudarme la IA?",
  ];

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }
  function newId() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return "s_" + Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  var sessionId = storage("senda_session") || newId();
  storage("senda_session", sessionId);
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem("senda_history_" + sessionId) || "[]"); } catch (e) {}
  function persist() {
    try { sessionStorage.setItem("senda_history_" + sessionId, JSON.stringify(history.slice(-60))); } catch (e) {}
  }

  var host = document.createElement("div");
  host.id = "senda-chat";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".fab{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;background:" + COLOR + ";color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:2147483000;transition:transform .15s}" +
    ".fab:hover{transform:scale(1.06)}" +
    ".panel{position:fixed;right:20px;bottom:92px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;color:#1f2937}" +
    ".panel.open{display:flex}" +
    "@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0}.fab.hide{display:none}}" +
    ".head{background:" + COLOR + ";color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}" +
    ".head b{display:block;font-size:15px}.head small{opacity:.85;font-size:12px}" +
    ".close{margin-left:auto;background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}" +
    ".msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}" +
    ".m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
    ".m.bot{background:#fff;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}" +
    ".m.user{background:" + COLOR + ";color:#fff;align-self:flex-end;border-bottom-right-radius:4px}" +
    ".m a{color:inherit}.m ul{margin:4px 0;padding-left:18px;white-space:normal}" +
    ".m.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}" +
    ".typing span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#9ca3af;animation:b 1s infinite}" +
    ".typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}" +
    "@keyframes b{0%,80%,100%{opacity:.3}40%{opacity:1}}" +
    ".chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:#f8fafc}" +
    ".chip{border:1px solid " + COLOR + ";color:" + COLOR + ";background:#fff;border-radius:999px;padding:6px 11px;font-size:13px;cursor:pointer}" +
    ".chip:hover{background:" + COLOR + ";color:#fff}" +
    "form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fff}" +
    "textarea{flex:1;resize:none;border:1px solid #d1d5db;border-radius:10px;padding:10px;font-size:14px;max-height:120px;outline:none;color:#111827;background:#fff}" +
    "textarea:focus{border-color:" + COLOR + "}" +
    ".send{border:0;background:" + COLOR + ";color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-size:14px}" +
    ".send:disabled{opacity:.5;cursor:default}" +
    ".foot{font-size:11px;color:#6b7280;text-align:center;padding:0 12px 8px;background:#fff}" +
    "</style>" +
    '<button class="fab" aria-label="Abrir chat"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>' +
    '<section class="panel" role="dialog" aria-label="Chat">' +
    '<div class="head"><div><b></b><small></small></div><button class="close" aria-label="Cerrar">×</button></div>' +
    '<div class="msgs" aria-live="polite"></div>' +
    '<div class="chips"></div>' +
    '<form><textarea rows="1" placeholder="Escribí tu consulta…" aria-label="Mensaje"></textarea><button class="send" type="submit">Enviar</button></form>' +
    '<div class="foot">Asistente con IA · puede cometer errores</div>' +
    "</section>";

  var $ = function (s) { return root.querySelector(s); };
  var fab = $(".fab"), panel = $(".panel"), msgs = $(".msgs"), chips = $(".chips"),
      form = $("form"), input = $("textarea"), sendBtn = $(".send");
  $(".head b").textContent = TITLE;
  $(".head small").textContent = SUBTITLE;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Markdown mínimo y seguro: negritas, links y listas.
  function render(text) {
    var html = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return html.replace(/(?:^|\n)((?:[-•*] .+(?:\n|$))+)/g, function (_, block) {
      var items = block.trim().split("\n").map(function (l) { return "<li>" + l.replace(/^[-•*] /, "") + "</li>"; });
      return "\n<ul>" + items.join("") + "</ul>";
    });
  }
  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "m " + role;
    el.innerHTML = render(text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }
  function showChips(show) {
    chips.innerHTML = "";
    if (!show) return;
    SUGGESTIONS.forEach(function (s) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = s;
      b.onclick = function () { send(s); };
      chips.appendChild(b);
    });
  }

  addMsg("bot", GREETING);
  history.forEach(function (h) { addMsg(h.role, h.text); });
  showChips(history.length === 0);

  function toggle(open) {
    panel.classList.toggle("open", open);
    fab.classList.toggle("hide", open);
    if (open) setTimeout(function () { input.focus(); }, 50);
  }
  fab.onclick = function () { toggle(!panel.classList.contains("open")); };
  $(".close").onclick = function () { toggle(false); };

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send(input.value);
  });

  var sending = false;
  async function send(text) {
    text = (text || "").trim();
    if (!text || sending) return;
    sending = true;
    sendBtn.disabled = true;
    showChips(false);
    input.value = "";
    input.style.height = "auto";
    addMsg("user", text);
    history.push({ role: "user", text: text });
    persist();

    var bubble = addMsg("bot", "");
    bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    var answer = "";
    try {
      var res = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId, message: text, pageUrl: location.href }),
      });
      if (!res.ok || !res.body) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || "No pudimos conectar con el asistente.");
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        parts.forEach(function (raw) {
          var ev = (raw.match(/^event: (.+)$/m) || [])[1];
          var data = (raw.match(/^data: (.+)$/m) || [])[1];
          if (!ev || !data) return;
          var payload = JSON.parse(data);
          if (ev === "delta") {
            answer += payload.text;
            bubble.innerHTML = render(answer);
            msgs.scrollTop = msgs.scrollHeight;
          } else if (ev === "error") {
            throw new Error(payload.message);
          }
        });
      }
      if (!answer) throw new Error("No recibimos respuesta. Probá de nuevo.");
      history.push({ role: "bot", text: answer });
      persist();
    } catch (e) {
      if (answer) {
        history.push({ role: "bot", text: answer });
        persist();
      } else {
        bubble.remove();
      }
      addMsg("bot err", e.message || "Ocurrió un error.");
    } finally {
      sending = false;
      sendBtn.disabled = false;
    }
  }
})();
