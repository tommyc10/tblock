// The film's motion vocabulary. Every helper adds tweens to a paused GSAP timeline at a given time,
// so each frame is a pure function of timeline time. Load after gsap and after assets/timing.js.
(function () {
  // Closed-form damped spring, 0 -> 1. damping is Apple's damping ratio; response is in seconds.
  function spring(t, damping, response) {
    if (t <= 0) return 0;
    var w = (2 * Math.PI) / response;
    if (damping >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    var wd = w * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
  }
  // A GSAP ease that plays the spring over `duration` seconds and lands exactly on 1.
  function springEase(damping, response, duration) {
    var end = spring(duration, damping, response);
    return function (p) { return p >= 1 ? 1 : spring(p * duration, damping, response) / end; };
  }
  var UI_IN = springEase(0.8, 0.45, 0.7);   // cards and panels: a hint of settle
  var SOFT_IN = springEase(1.0, 0.5, 0.75); // rows and text: no overshoot
  var POP = springEase(0.7, 0.35, 0.45);    // chips and badges: a small bounce

  var F = { spring: spring, springEase: springEase, UI_IN: UI_IN, SOFT_IN: SOFT_IN, POP: POP };
  var T = window.FILM_T || { scenes: {}, beat: 0 };

  // Scene length and beat, written by build.mjs into assets/timing.js.
  F.dur = function (id) { return T.scenes[id] ? T.scenes[id].dur : 0; };
  F.beat = function (n) { return T.beat ? n * T.beat : 0; };
  // The first shot is frame 0, the thumbnail on social players, so its card starts on screen.
  F.first = function (id) { return !!T.scenes[id] && T.scenes[id].start === 0; };
  // The cue list a scene declares in <script type="application/json" id="<id>-cues">.
  F.cues = function (id) {
    var el = document.getElementById(id + "-cues"), out = {};
    if (el) JSON.parse(el.textContent).forEach(function (c) { if (c[3]) out[c[3]] = c[0]; });
    return out;
  };

  // A card or panel arrives: scale and y on a spring, opacity on a short curve. { shown: true } skips the fade.
  F.popIn = function (tl, sel, at, o) {
    o = o || {};
    if (!o.shown) tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power2.out" }, at);
    tl.fromTo(sel, { scale: o.fromScale || 0.95, y: o.fromY == null ? 24 : o.fromY, x: o.fromX || 0 },
      { scale: 1, y: 0, x: 0, duration: 0.7, ease: UI_IN }, at);
  };
  // Leaves in one motion, about a third of the entrance.
  F.popOut = function (tl, sel, at) {
    tl.to(sel, { opacity: 0, scale: 0.96, filter: "blur(8px)", duration: 0.22, ease: "power3.in" }, at);
  };
  // A row of a list lands; pass an array for a stagger. In the first shot rows start at 0.75 so frame 0 reads.
  F.rowIn = function (tl, sel, at, stagger, from) {
    tl.fromTo(sel, { opacity: from || 0, x: -14 }, { opacity: 1, x: 0, duration: 0.5, ease: SOFT_IN, stagger: stagger || 0 }, at);
  };
  // A chip or badge pops.
  F.pop = function (tl, sel, at) {
    tl.fromTo(sel, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: POP }, at);
  };
  // One label becomes another in place: the old one blurs out, the new one pops in.
  F.swap = function (tl, from, to, at, origin) {
    tl.to(from, { opacity: 0, filter: "blur(6px)", duration: 0.14 }, at);
    tl.fromTo(to, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: POP, transformOrigin: origin || "50% 50%" }, at + 0.06);
  };

  // Captions: <div class="cap" data-text="It starts with a *meeting.*">. Words between * take the accent.
  F.split = function (el) {
    var em = false; el.textContent = "";
    el.getAttribute("data-text").split(" ").forEach(function (w) {
      var s = document.createElement("span"); s.className = "w";
      if (w.charAt(0) === "*") em = true;
      if (em) s.className += " accent";
      if (w.charAt(w.length - 1) === "*") em = false;
      s.textContent = w.replace(/\*/g, ""); el.appendChild(s);
    });
  };
  // Word by word out of a blur, no movement, then dead still.
  F.capIn = function (tl, sel, at) {
    document.querySelectorAll(sel).forEach(function (el) { if (!el.children.length) F.split(el); });
    tl.fromTo(sel + " .w", { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.16, ease: "power2.out", stagger: 0.06 }, at);
  };
  F.capOut = function (tl, sel, at) {
    tl.to(sel + " .w", { opacity: 0, filter: "blur(8px)", duration: 0.16, ease: "power2.in", stagger: 0.025 }, at);
  };

  // A cursor follows keyframes [t, x, y, ease?]. Its tip is its top-left corner.
  F.path = function (tl, sel, keys) {
    tl.set(sel, { x: keys[0][1], y: keys[0][2], transformOrigin: "0 0" }, 0);
    for (var k = 1; k < keys.length; k++) {
      tl.fromTo(sel, { x: keys[k - 1][1], y: keys[k - 1][2] },
        { x: keys[k][1], y: keys[k][2], duration: keys[k][0] - keys[k - 1][0], ease: keys[k][3] || "power3.inOut", immediateRender: false }, keys[k - 1][0]);
    }
  };
  // The cursor presses, and the button under it gives a little.
  F.click = function (tl, cur, btn, at) {
    tl.to(cur, { scale: 0.86, duration: 0.07, ease: "power2.in" }, at);
    tl.to(cur, { scale: 1, duration: 0.22, ease: "power2.out" }, at + 0.07);
    if (btn) {
      tl.to(btn, { scale: 0.95, duration: 0.07, ease: "power2.in" }, at);
      tl.to(btn, { scale: 1, duration: 0.3, ease: springEase(0.6, 0.3, 0.3) }, at + 0.07);
    }
  };

  // Types text into a host, one character per `gap` seconds. parts: [["text", "class?"], ...]. Returns the end time.
  F.type = function (tl, host, parts, at, gap) {
    var el = typeof host === "string" ? document.querySelector(host) : host, i = 0;
    gap = gap || 0.032;
    parts.forEach(function (p) {
      var seg = document.createElement("span"); if (p[1]) seg.className = p[1]; el.appendChild(seg);
      p[0].split("").forEach(function (ch) {
        var c = document.createElement("span"); c.textContent = ch === " " ? " " : ch; c.style.display = "none"; seg.appendChild(c);
        tl.set(c, { display: "inline" }, at + i * gap); i += 1;
      });
    });
    return at + i * gap;
  };
  // A number counts from a to b. Drive text with a proxy, never tl.set(textContent).
  F.count = function (tl, sel, a, b, at, duration, fmt, ease) {
    var el = document.querySelector(sel), o = { v: a };
    fmt = fmt || function (v) { return Math.round(v).toLocaleString("en-US"); };
    el.textContent = fmt(a);
    tl.fromTo(o, { v: a }, { v: b, duration: duration, ease: ease || "power2.out", immediateRender: false, onUpdate: function () { el.textContent = fmt(o.v); } }, at);
  };

  // Camera. One move per shot: drift in, push through to cut, or bring one thing forward.
  F.drift = function (tl, sel, at, duration) {
    tl.fromTo(sel, { scale: 1 }, { scale: 1.03, duration: duration, ease: "none" }, at);
  };
  F.through = function (tl, stage, at) {
    tl.to(stage, { scale: 1.3, opacity: 0, filter: "blur(14px)", duration: 0.32, ease: "power3.in" }, at);
  };
  F.focus = function (tl, keep, dim, at) {
    tl.to(dim, { opacity: 0.35, scale: 0.97, duration: 0.45, ease: "power2.inOut" }, at);
    tl.to(keep, { scale: 1.04, duration: 0.6, ease: SOFT_IN }, at);
  };
  // An ink circle opens out of the previous shot (the end card).
  F.iris = function (tl, stage, at) {
    tl.fromTo(stage, { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)", duration: 0.6, ease: "power3.inOut" }, at);
  };

  F.CURSOR = '<svg viewBox="0 0 34 50"><path d="M3 3v38l10-10 7 16 6-3-7-15h14z" fill="#0f0f0f" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  window.FILM = F;
})();
