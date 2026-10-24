/*
 * Widget de voz de Senda Consultora (modo llamada, manos libres).
 * Uso en cualquier sitio:
 *   <script src="https://TU-SERVIDOR/widget.js" defer
 *           data-title="Senda Consultora" data-color="#0f766e"></script>
 * Atributos opcionales: data-api (URL del servidor; por defecto, el origen de este script),
 * data-title, data-subtitle, data-color, data-greeting, data-lang (por defecto "es-AR").
 *
 * Usa el reconocimiento y la síntesis de voz del navegador (Chrome, Edge, Safari).
 * En navegadores sin reconocimiento de voz (por ejemplo Firefox) ofrece escribir.
 * El micrófono solo funciona en sitios con HTTPS (o en localhost).
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var ds = (script && script.dataset) || {};
  var API = (ds.api || (script ? new URL(script.src).origin : "")).replace(/\/$/, "");
  var TITLE = ds.title || "Senda Consultora";
  var SUBTITLE = ds.subtitle || "Asistente por voz";
  var COLOR = ds.color || "#0f766e";
  var LANG = ds.lang || "es-AR";
  var GREETING =
    ds.greeting ||
    "¡Hola! Soy Senda, la asistente de Senda Consultora. Te puedo ayudar con marketing, estrategia comercial, finanzas o inteligencia artificial. Contame, ¿qué necesitás para tu negocio?";

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var TTS = window.speechSynthesis;
  var voiceSupported = Boolean(SR && TTS);

  // ---------- Sesión ----------
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }
  function newId() {
    var a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return "v_" + Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  var sessionId = store("senda_voice_session") || newId();
  store("senda_voice_session", sessionId);

  // ---------- Interfaz ----------
  var host = document.createElement("div");
  host.id = "senda-voice";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".fab{position:fixed;right:20px;bottom:20px;height:60px;padding:0 22px 0 18px;border-radius:999px;border:0;background:" + COLOR + ";color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;z-index:2147483000;transition:transform .15s}" +
    ".fab:hover{transform:scale(1.04)}" +
    ".panel{position:fixed;right:20px;bottom:20px;width:360px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 40px);background:#0b1220;color:#e5e7eb;border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.35);display:none;flex-direction:column;overflow:hidden;z-index:2147483001}" +
    ".panel.open{display:flex}" +
    "@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0}}" +
    ".head{padding:16px 18px;display:flex;align-items:center;gap:10px}" +
    ".head b{display:block;font-size:15px;color:#fff}.head small{color:#94a3b8;font-size:12px}" +
    ".x{margin-left:auto;background:none;border:0;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1}" +
    ".stage{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:0 20px;min-height:0}" +
    ".orb{width:150px;height:150px;border-radius:50%;border:0;cursor:pointer;background:radial-gradient(circle at 35% 30%,#fff3," + COLOR + " 55%,#000a);box-shadow:0 0 0 0 " + COLOR + "88;display:flex;align-items:center;justify-content:center;color:#fff;transition:transform .2s;flex-shrink:0}" +
    ".orb:focus-visible{outline:3px solid #fff}" +
    ".orb svg{width:52px;height:52px}" +
    ".listening .orb{animation:pulse 1.4s infinite}" +
    ".thinking .orb{animation:breathe 1s ease-in-out infinite alternate;opacity:.85}" +
    ".speaking .orb{animation:talk .5s ease-in-out infinite alternate}" +
    "@keyframes pulse{0%{box-shadow:0 0 0 0 " + COLOR + "aa}100%{box-shadow:0 0 0 34px " + COLOR + "00}}" +
    "@keyframes breathe{from{transform:scale(.94)}to{transform:scale(1.02)}}" +
    "@keyframes talk{from{transform:scale(1)}to{transform:scale(1.08)}}" +
    ".status{font-size:15px;color:#cbd5e1;text-align:center;min-height:22px}" +
    ".captions{width:100%;max-height:40%;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px}" +
    ".c{font-size:14px;line-height:1.4;padding:8px 12px;border-radius:12px;max-width:90%}" +
    ".c.bot{background:#1e293b;align-self:flex-start}" +
    ".c.user{background:" + COLOR + ";color:#fff;align-self:flex-end}" +
    ".c.interim{opacity:.6;font-style:italic}" +
    ".c.err{background:#450a0a;color:#fecaca}" +
    ".controls{display:flex;justify-content:center;gap:14px;padding:16px}" +
    ".btn{border:0;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer}" +
    ".end{background:#dc2626;color:#fff}.alt{background:#1e293b;color:#e2e8f0}" +
    "form{display:none;gap:8px;padding:0 16px 16px}form.show{display:flex}" +
    "input{flex:1;border:1px solid #334155;background:#0f172a;color:#fff;border-radius:10px;padding:11px;font-size:14px;outline:none}" +
    "input:focus{border-color:" + COLOR + "}" +
    ".send{border:0;background:" + COLOR + ";color:#fff;border-radius:10px;padding:0 14px;cursor:pointer}" +
    ".foot{font-size:11px;color:#64748b;text-align:center;padding:0 12px 10px}" +
    "</style>" +
    '<button class="fab" aria-label="Hablar con el asistente">' + micIcon() + "<span>Hablá con nosotros</span></button>" +
    '<section class="panel" role="dialog" aria-label="Asistente por voz">' +
    '<div class="head"><div><b></b><small></small></div><button class="x" aria-label="Cerrar">×</button></div>' +
    '<div class="stage"><button class="orb" aria-label="Iniciar conversación"></button><div class="status" aria-live="polite"></div><div class="captions"></div></div>' +
    '<form><input placeholder="Escribí tu mensaje…" aria-label="Mensaje"><button class="send" type="submit">Enviar</button></form>' +
    '<div class="controls"><button class="btn alt" type="button">Prefiero escribir</button><button class="btn end" type="button">Finalizar</button></div>' +
    '<div class="foot">Asistente con IA · puede cometer errores</div>' +
    "</section>";

  function micIcon() {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></svg>';
  }
  function stopIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  }

  var $ = function (s) { return root.querySelector(s); };
  var fab = $(".fab"), panel = $(".panel"), stage = $(".stage"), orb = $(".orb"),
      statusEl = $(".status"), captions = $(".captions"), form = $("form"),
      input = $("input"), altBtn = $(".alt"), endBtn = $(".end");
  $(".head b").textContent = TITLE;
  $(".head small").textContent = SUBTITLE;

  // Estados: idle | listening | thinking | speaking
  var state = "idle";
  var inCall = false;
  function setState(s, text) {
    state = s;
    stage.className = "stage " + s;
    statusEl.textContent = text || "";
    orb.innerHTML = s === "speaking" || s === "thinking" ? stopIcon() : micIcon().replace('width="24" height="24"', "");
    orb.setAttribute(
      "aria-label",
      s === "idle" ? "Iniciar conversación" : s === "listening" ? "Escuchando" : "Interrumpir",
    );
  }

  function caption(role, text) {
    var el = document.createElement("div");
    el.className = "c " + role;
    el.textContent = text;
    captions.appendChild(el);
    captions.scrollTop = captions.scrollHeight;
    return el;
  }

  // Limpia el texto para leerlo en voz alta (por si el modelo usa algún formato).
  function speakable(text) {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*_#`>•]/g, "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/^\s*[-–]\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ---------- Síntesis de voz (TTS) ----------
  var voice = null;
  function pickVoice() {
    if (!TTS) return;
    var voices = TTS.getVoices();
    var base = LANG.slice(0, 2);
    var score = function (v) {
      var s = 0;
      if (v.lang.replace("_", "-") === LANG) s += 4;
      else if (v.lang.slice(0, 2) === base) s += 2;
      else return -1;
      if (/natural|neural|online|google|premium|enhanced/i.test(v.name)) s += 3;
      return s;
    };
    var best = null, bestScore = -1;
    voices.forEach(function (v) {
      var s = score(v);
      if (s > bestScore) { best = v; bestScore = s; }
    });
    voice = best;
  }
  if (TTS) {
    pickVoice();
    if ("onvoiceschanged" in TTS) TTS.onvoiceschanged = pickVoice;
  }

  // Cola de oraciones: se habla a medida que llega la respuesta, sin esperar al final.
  var speechQueue = [];
  var speaking = false;
  var currentUtterance = null;
  var streamDone = true;
  var onQueueEmpty = null;

  function enqueueSpeech(text) {
    var clean = speakable(text);
    if (!clean) return;
    speechQueue.push(clean);
    if (!speaking) speakNext();
  }
  function speakNext() {
    if (!TTS) return finishSpeaking();
    var next = speechQueue.shift();
    if (!next) {
      speaking = false;
      if (streamDone) finishSpeaking();
      return;
    }
    speaking = true;
    if (state !== "speaking") setState("speaking", "Hablando… (tocá para interrumpir)");
    var u = new SpeechSynthesisUtterance(next);
    u.lang = LANG;
    if (voice) u.voice = voice;
    u.rate = 1.05;
    u.onend = u.onerror = function () {
      if (currentUtterance === u) speakNext();
    };
    currentUtterance = u; // se guarda la referencia: Chrome corta el audio si se pierde
    TTS.speak(u);
  }
  function finishSpeaking() {
    speaking = false;
    var cb = onQueueEmpty;
    onQueueEmpty = null;
    if (cb) cb();
  }
  function stopSpeaking() {
    speechQueue = [];
    onQueueEmpty = null;
    speaking = false;
    currentUtterance = null;
    if (TTS) TTS.cancel();
  }

  // ---------- Reconocimiento de voz (STT) ----------
  var rec = null;
  var silentRounds = 0;
  var interimEl = null;

  function listen() {
    if (!inCall || !voiceSupported) return;
    if (rec) try { rec.abort(); } catch (e) {}
    rec = new SR();
    rec.lang = LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    var finalText = "";
    var gotError = null;

    rec.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      var shown = (finalText + " " + interim).trim();
      if (shown) {
        if (!interimEl) interimEl = caption("user interim", shown);
        else interimEl.textContent = shown;
        captions.scrollTop = captions.scrollHeight;
      }
    };
    rec.onerror = function (e) { gotError = e.error; };
    rec.onend = function () {
      if (!inCall || state !== "listening") return;
      var text = finalText.trim();
      if (text) {
        silentRounds = 0;
        if (interimEl) { interimEl.className = "c user"; interimEl.textContent = text; interimEl = null; }
        send(text, true);
        return;
      }
      if (interimEl) { interimEl.remove(); interimEl = null; }
      if (gotError === "not-allowed" || gotError === "service-not-allowed") {
        endCall();
        caption("err", "No tenemos permiso para usar el micrófono. Habilitalo en el navegador o tocá \"Prefiero escribir\".");
        return;
      }
      if (gotError === "network") {
        endCall();
        caption("err", "El reconocimiento de voz no está disponible ahora. Podés escribir tu mensaje.");
        showTextInput();
        return;
      }
      // Silencio: se vuelve a escuchar unas veces y después se pausa para no dejar el micrófono abierto.
      if (++silentRounds >= 3) {
        silentRounds = 0;
        pauseCall();
        return;
      }
      listen();
    };
    setState("listening", "Te escucho…");
    try { rec.start(); } catch (e) { setTimeout(listen, 300); }
  }
  function stopListening() {
    if (rec) {
      rec.onend = null;
      try { rec.abort(); } catch (e) {}
      rec = null;
    }
    if (interimEl) { interimEl.remove(); interimEl = null; }
  }

  // ---------- Conversación ----------
  var abortCtrl = null;

  async function send(text, viaVoice) {
    text = (text || "").trim();
    if (!text) return;
    if (!viaVoice) caption("user", text);
    stopListening();
    setState("thinking", "Pensando…");
    streamDone = false;
    abortCtrl = new AbortController();
    var answer = "";
    var pending = "";
    var botEl = null;
    var speakAloud = voiceSupported && inCall;

    function flush(force) {
      // Habla cada oración completa apenas llega.
      var re = /^([\s\S]*?[.!?…:;])(\s+|$)/;
      var m;
      while ((m = pending.match(re)) && (m[2] || force)) {
        if (speakAloud) enqueueSpeech(m[1]);
        pending = pending.slice(m[0].length);
      }
      if (force && pending.trim()) {
        if (speakAloud) enqueueSpeech(pending);
        pending = "";
      }
    }

    try {
      var res;
      // 409 = el servidor todavía termina una respuesta que se interrumpió: se reintenta.
      for (var attempt = 0; attempt < 15; attempt++) {
        res = await fetch(API + "/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId, message: text, pageUrl: location.href, channel: "voz" }),
          signal: abortCtrl.signal,
        });
        if (res.status !== 409) break;
        await new Promise(function (r) { setTimeout(r, 1000); });
      }
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
        for (var i = 0; i < parts.length; i++) {
          var ev = (parts[i].match(/^event: (.+)$/m) || [])[1];
          var data = (parts[i].match(/^data: (.+)$/m) || [])[1];
          if (!ev || !data) continue;
          var payload = JSON.parse(data);
          if (ev === "delta") {
            answer += payload.text;
            pending += payload.text;
            if (!botEl) botEl = caption("bot", "");
            botEl.textContent = speakable(answer);
            captions.scrollTop = captions.scrollHeight;
            flush(false);
          } else if (ev === "error") {
            throw new Error(payload.message);
          }
        }
      }
      flush(true);
      if (!answer) throw new Error("No recibimos respuesta. Probá de nuevo.");
    } catch (e) {
      if (e.name === "AbortError") return;
      stopSpeaking();
      caption("err", e.message || "Ocurrió un error.");
      if (speakAloud) enqueueSpeech(e.message || "Ocurrió un error.");
    } finally {
      abortCtrl = null;
    }
    streamDone = true;
    afterReply(speakAloud);
  }

  function afterReply(spoke) {
    var next = function () {
      if (inCall) listen();
      else setState("idle", voiceSupported ? "Tocá el micrófono para hablar" : "");
    };
    if (spoke && (speaking || speechQueue.length)) onQueueEmpty = next;
    else next();
  }

  // ---------- Controles ----------
  function startCall() {
    if (!voiceSupported) {
      showTextInput();
      return;
    }
    inCall = true;
    silentRounds = 0;
    // El saludo se dice en el mismo toque del usuario (requisito de Safari/iOS para el audio).
    if (!captions.childElementCount) {
      caption("bot", GREETING);
      streamDone = true;
      onQueueEmpty = listen;
      enqueueSpeech(GREETING);
    } else {
      listen();
    }
  }
  function pauseCall() {
    inCall = false;
    stopListening();
    setState("idle", "¿Seguís ahí? Tocá el micrófono para continuar");
  }
  function endCall() {
    inCall = false;
    stopListening();
    stopSpeaking();
    if (abortCtrl) abortCtrl.abort();
    setState("idle", voiceSupported ? "Tocá el micrófono para hablar" : "");
  }
  function interrupt() {
    // Corta lo que está diciendo el asistente y vuelve a escuchar.
    stopSpeaking();
    streamDone = true;
    if (abortCtrl) abortCtrl.abort();
    inCall = true;
    listen();
  }
  function showTextInput() {
    form.classList.add("show");
    altBtn.style.display = "none";
    setTimeout(function () { input.focus(); }, 50);
  }

  orb.onclick = function () {
    if (state === "idle") startCall();
    else if (state === "speaking" || state === "thinking") interrupt();
    else if (state === "listening") pauseCall();
  };
  endBtn.onclick = endCall;
  altBtn.onclick = function () {
    endCall();
    showTextInput();
  };
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = input.value;
    input.value = "";
    if (inCall) stopListening();
    send(t, false);
  });

  function open() {
    panel.classList.add("open");
    fab.style.display = "none";
    if (!voiceSupported) {
      caption("bot", GREETING);
      caption("err", "Tu navegador no permite conversar por voz (probá con Chrome, Edge o Safari). Podés escribirnos acá.");
      showTextInput();
      setState("idle", "");
      return;
    }
    // Abrir el panel ya cuenta como gesto del usuario: arranca la conversación directamente.
    startCall();
  }
  function close() {
    endCall();
    panel.classList.remove("open");
    fab.style.display = "";
  }
  fab.onclick = open;
  $(".x").onclick = close;
  setState("idle", "Tocá el micrófono para hablar");
})();
