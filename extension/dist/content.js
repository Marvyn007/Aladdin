function detectJobApplicationPageDetailed() {
  if (isSuppressedPage()) return { platform: null, strength: null };
  const byUrl = detectByUrlPattern();
  if (byUrl) return { platform: byUrl, strength: "strong" };
  const byParam = detectByUrlParams();
  if (byParam) return { platform: byParam, strength: "strong" };
  const byFingerprint = detectByATSFingerprint();
  if (byFingerprint) return { platform: byFingerprint, strength: "strong" };
  const { platform: platform2, signalCount } = detectByDomSignals();
  if (platform2 === "generic") return { platform: "generic", strength: "strong" };
  if (platform2 === "generic-weak" || signalCount === 1) {
    return { platform: "generic-weak", strength: "weak" };
  }
  return { platform: null, strength: null };
}
const SUPPRESSED_PATH_PATTERNS = [
  /\/log[-_]?in(\/|$)/i,
  /\/sign[-_]?in(\/|$)/i,
  /\/sign[-_]?up(\/|$)/i,
  /\/register(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/cart(\/|$)/i,
  /\/basket(\/|$)/i,
  /\/account\/billing/i,
  /\/billing(\/|$)/i,
  /\/subscribe(\/|$)/i,
  /\/payments?(\/|$)/i,
  /\/search(\/|$)/i
];
const SUPPRESSED_SUBMIT_TEXT = /^\s*(sign\s*in|log\s*in|log\s*on|login|pay|pay\s*now|continue\s*to\s*payment|place\s*order|subscribe|search)\s*$/i;
function isSuppressedPage() {
  const path = location.pathname || "";
  if (SUPPRESSED_PATH_PATTERNS.some((re) => re.test(path))) return true;
  const submit = document.querySelector(
    'button[type="submit"], input[type="submit"], button[data-testid*="submit" i]'
  );
  if (submit) {
    const text = (submit.textContent || submit.value || submit.getAttribute("aria-label") || "").trim();
    if (SUPPRESSED_SUBMIT_TEXT.test(text)) return true;
  }
  return false;
}
function detectByUrlPattern() {
  const url = location.href;
  if (/greenhouse\.io\/[^/]+\/jobs\/|boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(url)) return "greenhouse";
  if (/jobs\.lever\.co\/[^/]+\/[a-f0-9-]{36}/.test(url)) return "lever";
  if (/myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/.test(url)) return "workday";
  if (/jobs\.ashbyhq\.com|ashbyhq\.com\/[^/]+/.test(url)) return "ashby";
  if (/icims\.com/.test(url)) return "icims";
  if (/recruiting\.ultipro\.com/.test(url)) return "ultipro";
  if (/smartrecruiters\.com\/[^/]+\/[^/]+/.test(url)) return "smartrecruiters";
  if (/jobvite\.com\/[^/]+\/job\/|app\.jobvite\.com\/j\//.test(url)) return "jobvite";
  if (/taleo\.net|taleo\.com/.test(url)) return "taleo";
  if (/successfactors\.com|sapsf\.com/.test(url)) return "successfactors";
  if (/bamboohr\.com/.test(url)) return "bamboohr";
  if (/jobs\.rippling\.com/.test(url)) return "rippling";
  if (/breezy\.hr/.test(url)) return "breezy";
  if (/recruitee\.com/.test(url)) return "recruitee";
  if (/wellfound\.com\/jobs/.test(url)) return "wellfound";
  if (/pinpointhq\.com/.test(url)) return "pinpoint";
  if (/app\.dover\.com/.test(url)) return "dover";
  if (/apply\.workable\.com/.test(url)) return "workable";
  if (/applytojob\.com/.test(url)) return "jazzhr";
  if (/bullhornstaffing\.com/.test(url)) return "bullhorn";
  if (/\.linkedin\.com\/jobs\/view\//.test(url)) return "linkedin";
  if (/indeed\.com\/(viewjob|jobs|apply)/.test(url)) return "indeed";
  if (/glassdoor\.com\/job/.test(url)) return "glassdoor";
  return null;
}
function detectByUrlParams() {
  const params = new URLSearchParams(location.search);
  if (params.has("gh_jid") || params.has("gh_src") || params.has("gh_aid")) return "greenhouse";
  if (params.has("ashby_jid") || params.has("ashbyJobId")) return "ashby";
  if (params.has("lever_source")) return "lever";
  if (params.has("workable_job")) return "workable";
  if (params.has("jvs") || params.has("__jvst")) return "jobvite";
  if (params.has("srjid")) return "smartrecruiters";
  return null;
}
function detectByATSFingerprint() {
  if (document.querySelector('iframe[src*="boards.greenhouse.io" i], iframe[src*="job-boards.greenhouse.io" i]')) return "greenhouse";
  if (document.querySelector('iframe[src*="jobs.lever.co" i]')) return "lever";
  if (document.querySelector('iframe[src*="apply.workable.com" i]')) return "workable";
  if (document.querySelector('iframe[src*="jobs.ashbyhq.com" i]')) return "ashby";
  if (document.querySelector('iframe[src*="myworkdayjobs.com" i]')) return "workday";
  if (document.querySelector('iframe[src*="icims.com" i]')) return "icims";
  if (document.querySelector('iframe[src*="smartrecruiters.com" i]')) return "smartrecruiters";
  if (document.querySelector('script[src*="boards.greenhouse.io" i], script[src*="greenhouse.io/embed" i]')) return "greenhouse";
  if (document.querySelector('script[src*="jobs.lever.co" i], script[src*="lever.co/embed" i]')) return "lever";
  if (document.querySelector('script[src*="ashbyhq.com" i]')) return "ashby";
  if (document.querySelector('script[src*="workable.com" i]')) return "workable";
  if (document.querySelector('meta[name="application-name"][content="Workday"]') || document.querySelector('[data-automation-id="jobPostingPage"]') || document.querySelector('[data-automation-id="jobApplicationPage"]') || document.querySelector("[data-automation-id]") && /workday/i.test(document.title)) return "workday";
  if (document.querySelector("[data-gh-id], [data-ghs-id]") || document.querySelector('meta[name="generator"][content*="Greenhouse" i]') || document.querySelector("div#grnhse_app, div#grnhse_iframe, #grnhse")) return "greenhouse";
  if (document.querySelector('[class*="lever-"], [data-qa*="lever"]') || document.querySelector('meta[name="generator"][content*="Lever" i]')) return "lever";
  if (document.querySelector('meta[name="generator"][content*="iCIMS" i]') || document.querySelector('[class*="icims-"]') || document.querySelector('link[href*="icims.com"]')) return "icims";
  if (document.getElementById("oracleTaleo") || document.querySelector('[id*="taleo" i]') || document.querySelector('script[src*="taleo"]')) return "taleo";
  if (document.querySelector('meta[name="generator"][content*="Ashby" i]') || document.querySelector("[data-ashby-job-posting-id], [data-ashby-application-id]") || document.querySelector("div#ashby_embed, div#ashby_job_board_embed")) return "ashby";
  if (document.querySelector('meta[name="generator"][content*="SmartRecruiters" i]') || document.querySelector('[class*="smartrecruiters"]')) return "smartrecruiters";
  if (document.querySelector("[data-workable-widget], [data-whatever-workable]")) return "workable";
  return null;
}
function detectByDomSignals() {
  var _a, _b;
  let score = 0;
  const form = document.querySelector("form");
  if (form && form.querySelector('input[type="file"]')) score += 1;
  const pageText = (((_a = document.body) == null ? void 0 : _a.innerText) || "").toLowerCase();
  const jobTextSignals = [
    "resume",
    "cover letter",
    "work authorization",
    "years of experience",
    "linkedin profile",
    "sponsorship",
    "eeo",
    "voluntary self-identification"
  ];
  if (jobTextSignals.some((s) => pageText.includes(s))) score += 1;
  const titleText = (document.title + " " + (((_b = document.querySelector("h1")) == null ? void 0 : _b.textContent) ?? "")).toLowerCase();
  if (/\b(apply|application|job application|careers?|hiring)\b/.test(titleText)) score += 1;
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const ld of ldScripts) {
    try {
      const data = JSON.parse(ld.textContent || "{}");
      const types = Array.isArray(data) ? data : [data];
      for (const t of types) {
        const ty = t == null ? void 0 : t["@type"];
        if (ty === "JobPosting" || Array.isArray(ty) && ty.includes("JobPosting")) {
          score += 1;
          break;
        }
      }
    } catch {
    }
  }
  if (form) {
    const visibleInputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    );
    const pathLower = location.pathname.toLowerCase();
    if (visibleInputs.length >= 4 && /\/(careers?|jobs?|apply|application)(\/|$)/.test(pathLower)) score += 1;
  }
  if (score >= 2) return { platform: "generic", signalCount: score };
  if (score === 1) return { platform: "generic-weak", signalCount: score };
  return { platform: null, signalCount: 0 };
}
function parseJobMeta() {
  var _a, _b, _c, _d, _e, _f;
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const ld of ldScripts) {
    try {
      const data = JSON.parse(ld.textContent || "{}");
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const ty = it == null ? void 0 : it["@type"];
        if (ty === "JobPosting" || Array.isArray(ty) && ty.includes("JobPosting")) {
          return {
            jobTitle: it.title ?? "",
            company: ((_a = it.hiringOrganization) == null ? void 0 : _a.name) ?? ""
          };
        }
      }
    } catch {
    }
  }
  const ogTitle = ((_b = document.querySelector('meta[property="og:title"]')) == null ? void 0 : _b.content) ?? "";
  const h1 = ((_d = (_c = document.querySelector("h1")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) ?? "";
  const titleTag = document.title ?? "";
  const jobTitle2 = h1 || ogTitle || titleTag;
  const ogSite = ((_e = document.querySelector('meta[property="og:site_name"]')) == null ? void 0 : _e.content) ?? "";
  const companyEl = document.querySelector('[class*="company" i], [class*="employer" i], [data-company]');
  const company2 = ((_f = companyEl == null ? void 0 : companyEl.textContent) == null ? void 0 : _f.trim()) || ogSite || "";
  return { jobTitle: jobTitle2, company: company2 };
}
const ATS_IFRAME_HOSTS = [
  "icims.com",
  "taleo.net",
  "taleo.com",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "apply.workable.com",
  "jobs.ashbyhq.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "jobs.smartrecruiters.com",
  "jobvite.com",
  "app.jobvite.com",
  "recruiting.ultipro.com"
];
function isAtsIframeHost(hostname = location.hostname) {
  const h = String(hostname || "").toLowerCase();
  return ATS_IFRAME_HOSTS.some((x) => h === x || h.endsWith("." + x) || h.includes(x));
}
const FATAL_PATTERNS = [
  "Extension context invalidated",
  "Access to storage is not allowed",
  "The message port closed",
  "Could not establish connection"
];
function isContextValid() {
  var _a;
  try {
    return !!((_a = chrome.runtime) == null ? void 0 : _a.id);
  } catch {
    return false;
  }
}
function isFatalExtensionError(error) {
  const msg = (error == null ? void 0 : error.message) ?? String(error);
  return FATAL_PATTERNS.some((pattern) => msg.includes(pattern));
}
async function safeSendMessage(message) {
  if (!isContextValid()) {
    return { _invalidated: true, error: "Extension context invalidated" };
  }
  try {
    return await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ _invalidated: true, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    });
  } catch (error) {
    if (isFatalExtensionError(error)) {
      return { _invalidated: true, error: "Extension context invalidated" };
    }
    console.warn("Aladdin sendMessage error:", error);
    throw error;
  }
}
var module$1 = {};
(function main(global, module, isWorker, workerSize) {
  var canUseWorker = !!(global.Worker && global.Blob && global.Promise && global.OffscreenCanvas && global.OffscreenCanvasRenderingContext2D && global.HTMLCanvasElement && global.HTMLCanvasElement.prototype.transferControlToOffscreen && global.URL && global.URL.createObjectURL);
  var canUsePaths = typeof Path2D === "function" && typeof DOMMatrix === "function";
  var canDrawBitmap = function() {
    if (!global.OffscreenCanvas) {
      return false;
    }
    try {
      var canvas = new OffscreenCanvas(1, 1);
      var ctx = canvas.getContext("2d");
      ctx.fillRect(0, 0, 1, 1);
      var bitmap = canvas.transferToImageBitmap();
      ctx.createPattern(bitmap, "no-repeat");
    } catch (e) {
      return false;
    }
    return true;
  }();
  function noop() {
  }
  function promise(func) {
    var ModulePromise = module.exports.Promise;
    var Prom = ModulePromise !== void 0 ? ModulePromise : global.Promise;
    if (typeof Prom === "function") {
      return new Prom(func);
    }
    func(noop, noop);
    return null;
  }
  var bitmapMapper = /* @__PURE__ */ function(skipTransform, map) {
    return {
      transform: function(bitmap) {
        if (skipTransform) {
          return bitmap;
        }
        if (map.has(bitmap)) {
          return map.get(bitmap);
        }
        var canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        map.set(bitmap, canvas);
        return canvas;
      },
      clear: function() {
        map.clear();
      }
    };
  }(canDrawBitmap, /* @__PURE__ */ new Map());
  var raf = function() {
    var TIME = Math.floor(1e3 / 60);
    var frame, cancel;
    var frames = {};
    var lastFrameTime = 0;
    if (typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function") {
      frame = function(cb) {
        var id = Math.random();
        frames[id] = requestAnimationFrame(function onFrame(time) {
          if (lastFrameTime === time || lastFrameTime + TIME - 1 < time) {
            lastFrameTime = time;
            delete frames[id];
            cb();
          } else {
            frames[id] = requestAnimationFrame(onFrame);
          }
        });
        return id;
      };
      cancel = function(id) {
        if (frames[id]) {
          cancelAnimationFrame(frames[id]);
        }
      };
    } else {
      frame = function(cb) {
        return setTimeout(cb, TIME);
      };
      cancel = function(timer) {
        return clearTimeout(timer);
      };
    }
    return { frame, cancel };
  }();
  var getWorker = /* @__PURE__ */ function() {
    var worker;
    var prom;
    var resolves = {};
    function decorate(worker2) {
      function execute(options, callback) {
        worker2.postMessage({ options: options || {}, callback });
      }
      worker2.init = function initWorker(canvas) {
        var offscreen = canvas.transferControlToOffscreen();
        worker2.postMessage({ canvas: offscreen }, [offscreen]);
      };
      worker2.fire = function fireWorker(options, size, done) {
        if (prom) {
          execute(options, null);
          return prom;
        }
        var id = Math.random().toString(36).slice(2);
        prom = promise(function(resolve) {
          function workerDone(msg) {
            if (msg.data.callback !== id) {
              return;
            }
            delete resolves[id];
            worker2.removeEventListener("message", workerDone);
            prom = null;
            bitmapMapper.clear();
            done();
            resolve();
          }
          worker2.addEventListener("message", workerDone);
          execute(options, id);
          resolves[id] = workerDone.bind(null, { data: { callback: id } });
        });
        return prom;
      };
      worker2.reset = function resetWorker() {
        worker2.postMessage({ reset: true });
        for (var id in resolves) {
          resolves[id]();
          delete resolves[id];
        }
      };
    }
    return function() {
      if (worker) {
        return worker;
      }
      if (!isWorker && canUseWorker) {
        var code = [
          "var CONFETTI, SIZE = {}, module = {};",
          "(" + main.toString() + ")(this, module, true, SIZE);",
          "onmessage = function(msg) {",
          "  if (msg.data.options) {",
          "    CONFETTI(msg.data.options).then(function () {",
          "      if (msg.data.callback) {",
          "        postMessage({ callback: msg.data.callback });",
          "      }",
          "    });",
          "  } else if (msg.data.reset) {",
          "    CONFETTI && CONFETTI.reset();",
          "  } else if (msg.data.resize) {",
          "    SIZE.width = msg.data.resize.width;",
          "    SIZE.height = msg.data.resize.height;",
          "  } else if (msg.data.canvas) {",
          "    SIZE.width = msg.data.canvas.width;",
          "    SIZE.height = msg.data.canvas.height;",
          "    CONFETTI = module.exports.create(msg.data.canvas);",
          "  }",
          "}"
        ].join("\n");
        try {
          worker = new Worker(URL.createObjectURL(new Blob([code])));
        } catch (e) {
          typeof console !== "undefined" && typeof console.warn === "function" ? console.warn("🎊 Could not load worker", e) : null;
          return null;
        }
        decorate(worker);
      }
      return worker;
    };
  }();
  var defaults = {
    particleCount: 50,
    angle: 90,
    spread: 45,
    startVelocity: 45,
    decay: 0.9,
    gravity: 1,
    drift: 0,
    ticks: 200,
    x: 0.5,
    y: 0.5,
    shapes: ["square", "circle"],
    zIndex: 100,
    colors: [
      "#26ccff",
      "#a25afd",
      "#ff5e7e",
      "#88ff5a",
      "#fcff42",
      "#ffa62d",
      "#ff36ff"
    ],
    // probably should be true, but back-compat
    disableForReducedMotion: false,
    scalar: 1
  };
  function convert(val, transform) {
    return transform ? transform(val) : val;
  }
  function isOk(val) {
    return !(val === null || val === void 0);
  }
  function prop(options, name, transform) {
    return convert(
      options && isOk(options[name]) ? options[name] : defaults[name],
      transform
    );
  }
  function onlyPositiveInt(number) {
    return number < 0 ? 0 : Math.floor(number);
  }
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
  function toDecimal(str) {
    return parseInt(str, 16);
  }
  function colorsToRgb(colors) {
    return colors.map(hexToRgb);
  }
  function hexToRgb(str) {
    var val = String(str).replace(/[^0-9a-f]/gi, "");
    if (val.length < 6) {
      val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
    }
    return {
      r: toDecimal(val.substring(0, 2)),
      g: toDecimal(val.substring(2, 4)),
      b: toDecimal(val.substring(4, 6))
    };
  }
  function getOrigin(options) {
    var origin = prop(options, "origin", Object);
    origin.x = prop(origin, "x", Number);
    origin.y = prop(origin, "y", Number);
    return origin;
  }
  function setCanvasWindowSize(canvas) {
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;
  }
  function setCanvasRectSize(canvas) {
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
  function getCanvas(zIndex) {
    var canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0px";
    canvas.style.left = "0px";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = zIndex;
    return canvas;
  }
  function ellipse(context, x, y, radiusX, radiusY, rotation, startAngle, endAngle, antiClockwise) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(radiusX, radiusY);
    context.arc(0, 0, 1, startAngle, endAngle, antiClockwise);
    context.restore();
  }
  function randomPhysics(opts) {
    var radAngle = opts.angle * (Math.PI / 180);
    var radSpread = opts.spread * (Math.PI / 180);
    return {
      x: opts.x,
      y: opts.y,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
      velocity: opts.startVelocity * 0.5 + Math.random() * opts.startVelocity,
      angle2D: -radAngle + (0.5 * radSpread - Math.random() * radSpread),
      tiltAngle: (Math.random() * (0.75 - 0.25) + 0.25) * Math.PI,
      color: opts.color,
      shape: opts.shape,
      tick: 0,
      totalTicks: opts.ticks,
      decay: opts.decay,
      drift: opts.drift,
      random: Math.random() + 2,
      tiltSin: 0,
      tiltCos: 0,
      wobbleX: 0,
      wobbleY: 0,
      gravity: opts.gravity * 3,
      ovalScalar: 0.6,
      scalar: opts.scalar,
      flat: opts.flat
    };
  }
  function updateFetti(context, fetti) {
    fetti.x += Math.cos(fetti.angle2D) * fetti.velocity + fetti.drift;
    fetti.y += Math.sin(fetti.angle2D) * fetti.velocity + fetti.gravity;
    fetti.velocity *= fetti.decay;
    if (fetti.flat) {
      fetti.wobble = 0;
      fetti.wobbleX = fetti.x + 10 * fetti.scalar;
      fetti.wobbleY = fetti.y + 10 * fetti.scalar;
      fetti.tiltSin = 0;
      fetti.tiltCos = 0;
      fetti.random = 1;
    } else {
      fetti.wobble += fetti.wobbleSpeed;
      fetti.wobbleX = fetti.x + 10 * fetti.scalar * Math.cos(fetti.wobble);
      fetti.wobbleY = fetti.y + 10 * fetti.scalar * Math.sin(fetti.wobble);
      fetti.tiltAngle += 0.1;
      fetti.tiltSin = Math.sin(fetti.tiltAngle);
      fetti.tiltCos = Math.cos(fetti.tiltAngle);
      fetti.random = Math.random() + 2;
    }
    var progress = fetti.tick++ / fetti.totalTicks;
    var x1 = fetti.x + fetti.random * fetti.tiltCos;
    var y1 = fetti.y + fetti.random * fetti.tiltSin;
    var x2 = fetti.wobbleX + fetti.random * fetti.tiltCos;
    var y2 = fetti.wobbleY + fetti.random * fetti.tiltSin;
    context.fillStyle = "rgba(" + fetti.color.r + ", " + fetti.color.g + ", " + fetti.color.b + ", " + (1 - progress) + ")";
    context.beginPath();
    if (canUsePaths && fetti.shape.type === "path" && typeof fetti.shape.path === "string" && Array.isArray(fetti.shape.matrix)) {
      context.fill(transformPath2D(
        fetti.shape.path,
        fetti.shape.matrix,
        fetti.x,
        fetti.y,
        Math.abs(x2 - x1) * 0.1,
        Math.abs(y2 - y1) * 0.1,
        Math.PI / 10 * fetti.wobble
      ));
    } else if (fetti.shape.type === "bitmap") {
      var rotation = Math.PI / 10 * fetti.wobble;
      var scaleX = Math.abs(x2 - x1) * 0.1;
      var scaleY = Math.abs(y2 - y1) * 0.1;
      var width = fetti.shape.bitmap.width * fetti.scalar;
      var height = fetti.shape.bitmap.height * fetti.scalar;
      var matrix = new DOMMatrix([
        Math.cos(rotation) * scaleX,
        Math.sin(rotation) * scaleX,
        -Math.sin(rotation) * scaleY,
        Math.cos(rotation) * scaleY,
        fetti.x,
        fetti.y
      ]);
      matrix.multiplySelf(new DOMMatrix(fetti.shape.matrix));
      var pattern = context.createPattern(bitmapMapper.transform(fetti.shape.bitmap), "no-repeat");
      pattern.setTransform(matrix);
      context.globalAlpha = 1 - progress;
      context.fillStyle = pattern;
      context.fillRect(
        fetti.x - width / 2,
        fetti.y - height / 2,
        width,
        height
      );
      context.globalAlpha = 1;
    } else if (fetti.shape === "circle") {
      context.ellipse ? context.ellipse(fetti.x, fetti.y, Math.abs(x2 - x1) * fetti.ovalScalar, Math.abs(y2 - y1) * fetti.ovalScalar, Math.PI / 10 * fetti.wobble, 0, 2 * Math.PI) : ellipse(context, fetti.x, fetti.y, Math.abs(x2 - x1) * fetti.ovalScalar, Math.abs(y2 - y1) * fetti.ovalScalar, Math.PI / 10 * fetti.wobble, 0, 2 * Math.PI);
    } else if (fetti.shape === "star") {
      var rot = Math.PI / 2 * 3;
      var innerRadius = 4 * fetti.scalar;
      var outerRadius = 8 * fetti.scalar;
      var x = fetti.x;
      var y = fetti.y;
      var spikes = 5;
      var step = Math.PI / spikes;
      while (spikes--) {
        x = fetti.x + Math.cos(rot) * outerRadius;
        y = fetti.y + Math.sin(rot) * outerRadius;
        context.lineTo(x, y);
        rot += step;
        x = fetti.x + Math.cos(rot) * innerRadius;
        y = fetti.y + Math.sin(rot) * innerRadius;
        context.lineTo(x, y);
        rot += step;
      }
    } else {
      context.moveTo(Math.floor(fetti.x), Math.floor(fetti.y));
      context.lineTo(Math.floor(fetti.wobbleX), Math.floor(y1));
      context.lineTo(Math.floor(x2), Math.floor(y2));
      context.lineTo(Math.floor(x1), Math.floor(fetti.wobbleY));
    }
    context.closePath();
    context.fill();
    return fetti.tick < fetti.totalTicks;
  }
  function animate(canvas, fettis, resizer, size, done) {
    var animatingFettis = fettis.slice();
    var context = canvas.getContext("2d");
    var animationFrame;
    var destroy;
    var prom = promise(function(resolve) {
      function onDone() {
        animationFrame = destroy = null;
        context.clearRect(0, 0, size.width, size.height);
        bitmapMapper.clear();
        done();
        resolve();
      }
      function update() {
        if (isWorker && !(size.width === workerSize.width && size.height === workerSize.height)) {
          size.width = canvas.width = workerSize.width;
          size.height = canvas.height = workerSize.height;
        }
        if (!size.width && !size.height) {
          resizer(canvas);
          size.width = canvas.width;
          size.height = canvas.height;
        }
        context.clearRect(0, 0, size.width, size.height);
        animatingFettis = animatingFettis.filter(function(fetti) {
          return updateFetti(context, fetti);
        });
        if (animatingFettis.length) {
          animationFrame = raf.frame(update);
        } else {
          onDone();
        }
      }
      animationFrame = raf.frame(update);
      destroy = onDone;
    });
    return {
      addFettis: function(fettis2) {
        animatingFettis = animatingFettis.concat(fettis2);
        return prom;
      },
      canvas,
      promise: prom,
      reset: function() {
        if (animationFrame) {
          raf.cancel(animationFrame);
        }
        if (destroy) {
          destroy();
        }
      }
    };
  }
  function confettiCannon(canvas, globalOpts) {
    var isLibCanvas = !canvas;
    var allowResize = !!prop(globalOpts || {}, "resize");
    var hasResizeEventRegistered = false;
    var globalDisableForReducedMotion = prop(globalOpts, "disableForReducedMotion", Boolean);
    var shouldUseWorker = canUseWorker && !!prop(globalOpts || {}, "useWorker");
    var worker = shouldUseWorker ? getWorker() : null;
    var resizer = isLibCanvas ? setCanvasWindowSize : setCanvasRectSize;
    var initialized = canvas && worker ? !!canvas.__confetti_initialized : false;
    var preferLessMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion)").matches;
    var animationObj;
    function fireLocal(options, size, done) {
      var particleCount = prop(options, "particleCount", onlyPositiveInt);
      var angle = prop(options, "angle", Number);
      var spread = prop(options, "spread", Number);
      var startVelocity = prop(options, "startVelocity", Number);
      var decay = prop(options, "decay", Number);
      var gravity = prop(options, "gravity", Number);
      var drift = prop(options, "drift", Number);
      var colors = prop(options, "colors", colorsToRgb);
      var ticks = prop(options, "ticks", Number);
      var shapes = prop(options, "shapes");
      var scalar = prop(options, "scalar");
      var flat = !!prop(options, "flat");
      var origin = getOrigin(options);
      var temp = particleCount;
      var fettis = [];
      var startX = canvas.width * origin.x;
      var startY = canvas.height * origin.y;
      while (temp--) {
        fettis.push(
          randomPhysics({
            x: startX,
            y: startY,
            angle,
            spread,
            startVelocity,
            color: colors[temp % colors.length],
            shape: shapes[randomInt(0, shapes.length)],
            ticks,
            decay,
            gravity,
            drift,
            scalar,
            flat
          })
        );
      }
      if (animationObj) {
        return animationObj.addFettis(fettis);
      }
      animationObj = animate(canvas, fettis, resizer, size, done);
      return animationObj.promise;
    }
    function fire(options) {
      var disableForReducedMotion = globalDisableForReducedMotion || prop(options, "disableForReducedMotion", Boolean);
      var zIndex = prop(options, "zIndex", Number);
      if (disableForReducedMotion && preferLessMotion) {
        return promise(function(resolve) {
          resolve();
        });
      }
      if (isLibCanvas && animationObj) {
        canvas = animationObj.canvas;
      } else if (isLibCanvas && !canvas) {
        canvas = getCanvas(zIndex);
        document.body.appendChild(canvas);
      }
      if (allowResize && !initialized) {
        resizer(canvas);
      }
      var size = {
        width: canvas.width,
        height: canvas.height
      };
      if (worker && !initialized) {
        worker.init(canvas);
      }
      initialized = true;
      if (worker) {
        canvas.__confetti_initialized = true;
      }
      function onResize() {
        if (worker) {
          var obj = {
            getBoundingClientRect: function() {
              if (!isLibCanvas) {
                return canvas.getBoundingClientRect();
              }
            }
          };
          resizer(obj);
          worker.postMessage({
            resize: {
              width: obj.width,
              height: obj.height
            }
          });
          return;
        }
        size.width = size.height = null;
      }
      function done() {
        animationObj = null;
        if (allowResize) {
          hasResizeEventRegistered = false;
          global.removeEventListener("resize", onResize);
        }
        if (isLibCanvas && canvas) {
          if (document.body.contains(canvas)) {
            document.body.removeChild(canvas);
          }
          canvas = null;
          initialized = false;
        }
      }
      if (allowResize && !hasResizeEventRegistered) {
        hasResizeEventRegistered = true;
        global.addEventListener("resize", onResize, false);
      }
      if (worker) {
        return worker.fire(options, size, done);
      }
      return fireLocal(options, size, done);
    }
    fire.reset = function() {
      if (worker) {
        worker.reset();
      }
      if (animationObj) {
        animationObj.reset();
      }
    };
    return fire;
  }
  var defaultFire;
  function getDefaultFire() {
    if (!defaultFire) {
      defaultFire = confettiCannon(null, { useWorker: true, resize: true });
    }
    return defaultFire;
  }
  function transformPath2D(pathString, pathMatrix, x, y, scaleX, scaleY, rotation) {
    var path2d = new Path2D(pathString);
    var t1 = new Path2D();
    t1.addPath(path2d, new DOMMatrix(pathMatrix));
    var t2 = new Path2D();
    t2.addPath(t1, new DOMMatrix([
      Math.cos(rotation) * scaleX,
      Math.sin(rotation) * scaleX,
      -Math.sin(rotation) * scaleY,
      Math.cos(rotation) * scaleY,
      x,
      y
    ]));
    return t2;
  }
  function shapeFromPath(pathData) {
    if (!canUsePaths) {
      throw new Error("path confetti are not supported in this browser");
    }
    var path, matrix;
    if (typeof pathData === "string") {
      path = pathData;
    } else {
      path = pathData.path;
      matrix = pathData.matrix;
    }
    var path2d = new Path2D(path);
    var tempCanvas = document.createElement("canvas");
    var tempCtx = tempCanvas.getContext("2d");
    if (!matrix) {
      var maxSize = 1e3;
      var minX = maxSize;
      var minY = maxSize;
      var maxX = 0;
      var maxY = 0;
      var width, height;
      for (var x = 0; x < maxSize; x += 2) {
        for (var y = 0; y < maxSize; y += 2) {
          if (tempCtx.isPointInPath(path2d, x, y, "nonzero")) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      width = maxX - minX;
      height = maxY - minY;
      var maxDesiredSize = 10;
      var scale = Math.min(maxDesiredSize / width, maxDesiredSize / height);
      matrix = [
        scale,
        0,
        0,
        scale,
        -Math.round(width / 2 + minX) * scale,
        -Math.round(height / 2 + minY) * scale
      ];
    }
    return {
      type: "path",
      path,
      matrix
    };
  }
  function shapeFromText(textData) {
    var text, scalar = 1, color = "#000000", fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", "Twemoji Mozilla", "system emoji", sans-serif';
    if (typeof textData === "string") {
      text = textData;
    } else {
      text = textData.text;
      scalar = "scalar" in textData ? textData.scalar : scalar;
      fontFamily = "fontFamily" in textData ? textData.fontFamily : fontFamily;
      color = "color" in textData ? textData.color : color;
    }
    var fontSize = 10 * scalar;
    var font = "" + fontSize + "px " + fontFamily;
    var canvas = new OffscreenCanvas(fontSize, fontSize);
    var ctx = canvas.getContext("2d");
    ctx.font = font;
    var size = ctx.measureText(text);
    var width = Math.ceil(size.actualBoundingBoxRight + size.actualBoundingBoxLeft);
    var height = Math.ceil(size.actualBoundingBoxAscent + size.actualBoundingBoxDescent);
    var padding = 2;
    var x = size.actualBoundingBoxLeft + padding;
    var y = size.actualBoundingBoxAscent + padding;
    width += padding + padding;
    height += padding + padding;
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext("2d");
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    var scale = 1 / scalar;
    return {
      type: "bitmap",
      // TODO these probably need to be transfered for workers
      bitmap: canvas.transferToImageBitmap(),
      matrix: [scale, 0, 0, scale, -width * scale / 2, -height * scale / 2]
    };
  }
  module.exports = function() {
    return getDefaultFire().apply(this, arguments);
  };
  module.exports.reset = function() {
    getDefaultFire().reset();
  };
  module.exports.create = confettiCannon;
  module.exports.shapeFromPath = shapeFromPath;
  module.exports.shapeFromText = shapeFromText;
})(function() {
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  return this || {};
}(), module$1, false);
const confetti = module$1.exports;
module$1.exports.create;
function fireConfetti(shadowRoot) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
  `;
  shadowRoot.appendChild(canvas);
  const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
  myConfetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ["#4f46e5", "#7c3aed", "#22c55e", "#f59e0b", "#ec4899"]
  });
  setTimeout(() => canvas.remove(), 4e3);
}
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const createSVGElement = ([tag, attrs, children]) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.keys(attrs).forEach((name) => {
    element.setAttribute(name, String(attrs[name]));
  });
  if (children == null ? void 0 : children.length) {
    children.forEach((child) => {
      const childElement = createSVGElement(child);
      element.appendChild(childElement);
    });
  }
  return element;
};
const createElement = (iconNode, customAttrs = {}) => {
  const tag = "svg";
  const attrs = {
    ...defaultAttributes,
    ...customAttrs
  };
  return createSVGElement([tag, attrs, iconNode]);
};
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Activity = [
  [
    "path",
    {
      d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
    }
  ]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ban = [
  ["path", { d: "M4.929 4.929 19.07 19.071" }],
  ["circle", { cx: "12", cy: "12", r: "10" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Check = [["path", { d: "M20 6 9 17l-5-5" }]];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ChevronRight = [["path", { d: "m9 18 6-6-6-6" }]];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const CircleCheck = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "m9 12 2 2 4-4" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Eye = [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const FileText = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
  ["path", { d: "M10 9H8" }],
  ["path", { d: "M16 13H8" }],
  ["path", { d: "M16 17H8" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Hourglass = [
  ["path", { d: "M5 22h14" }],
  ["path", { d: "M5 2h14" }],
  ["path", { d: "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" }],
  ["path", { d: "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const House = [
  ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
  [
    "path",
    {
      d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    }
  ]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Link2 = [
  ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2" }],
  ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2" }],
  ["line", { x1: "8", x2: "16", y1: "12", y2: "12" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const LogOut = [
  ["path", { d: "m16 17 5-5-5-5" }],
  ["path", { d: "M21 12H9" }],
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Pause = [
  ["rect", { x: "14", y: "3", width: "5", height: "18", rx: "1" }],
  ["rect", { x: "5", y: "3", width: "5", height: "18", rx: "1" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Play = [
  [
    "path",
    { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" }
  ]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Plus = [
  ["path", { d: "M5 12h14" }],
  ["path", { d: "M12 5v14" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const RefreshCw = [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }],
  ["path", { d: "M21 3v5h-5" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }],
  ["path", { d: "M8 16H3v5" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Save = [
  [
    "path",
    {
      d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
    }
  ],
  ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
  ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Settings = [
  [
    "path",
    {
      d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const SkipForward = [
  ["path", { d: "M21 4v16" }],
  [
    "path",
    { d: "M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" }
  ]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Square = [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Trash2 = [
  ["path", { d: "M10 11v6" }],
  ["path", { d: "M14 11v6" }],
  ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
  ["path", { d: "M3 6h18" }],
  ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
];
/**
 * @license lucide v0.542.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Upload = [
  ["path", { d: "M12 3v12" }],
  ["path", { d: "m17 8-5-5-5 5" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
];
function lucideSvg(icon, size, extraClass = "") {
  const el = createElement(icon, {
    width: size,
    height: size,
    class: `aa-inline-icon${extraClass ? ` ${extraClass}` : ""}`,
    "aria-hidden": "true"
  });
  return el.outerHTML;
}
const inlineIcons = {
  home: (s = 24) => lucideSvg(House, s),
  settings: (s = 24) => lucideSvg(Settings, s),
  activity: (s = 24) => lucideSvg(Activity, s),
  play: (s = 22) => lucideSvg(Play, s),
  pause: (s = 22) => lucideSvg(Pause, s),
  stop: (s = 22) => lucideSvg(Square, s),
  skip: (s = 22) => lucideSvg(SkipForward, s),
  connect: (s = 18) => lucideSvg(Link2, s),
  signOut: (s = 22) => lucideSvg(LogOut, s),
  refresh: (s = 22) => lucideSvg(RefreshCw, s),
  document: (s = 22) => lucideSvg(FileText, s),
  preview: (s = 20) => lucideSvg(Eye, s),
  chevronRight: (s = 18) => lucideSvg(ChevronRight, s),
  block: (s = 48) => lucideSvg(Ban, s),
  add: (s = 22) => lucideSvg(Plus, s),
  save: (s = 22) => lucideSvg(Save, s),
  hourglass: (s = 22) => lucideSvg(Hourglass, s),
  uploadFile: (s = 22) => lucideSvg(Upload, s),
  check: (s = 22) => lucideSvg(Check, s),
  skipNext: (s = 22) => lucideSvg(SkipForward, s),
  delete: (s = 18) => lucideSvg(Trash2, s),
  checkCircle: (s = 48) => lucideSvg(CircleCheck, s)
};
const LOGO_URL = chrome.runtime.getURL("assets/aladdin-logo.png");
const WHITE_SIDE = 76;
const GRIP = 34;
const PANEL_WIDTH = 400;
const PANEL_TOP_ANCHOR = 56;
const GUTTER = 16;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
function cloneDraft(draft) {
  return {
    answers: { ...(draft == null ? void 0 : draft.answers) ?? {} },
    customQA: Array.isArray(draft == null ? void 0 : draft.customQA) ? draft.customQA.map((entry) => ({
      question: typeof (entry == null ? void 0 : entry.question) === "string" ? entry.question : "",
      answer: typeof (entry == null ? void 0 : entry.answer) === "string" ? entry.answer : ""
    })) : []
  };
}
class AutoApplyPanel {
  constructor(shadowRoot) {
    this.shadowRoot = shadowRoot;
    this.host = shadowRoot.host;
    this.state = "idle";
    this.logEntries = [];
    this.answers = [];
    this.captchaAlert = false;
    this.fileAlert = null;
    this.askingQuestion = null;
    this.autoAdvance = false;
    this.onStart = null;
    this.onPause = null;
    this.onResume = null;
    this.onSkip = null;
    this.onSaveSettings = null;
    this.onAutoAdvanceChange = null;
    this.onSignIn = null;
    this.onDisconnect = null;
    this.onConnectPat = null;
    this.onOpenAladdin = null;
    this.onStop = null;
    this.patConnectError = null;
    this.patConnectBusy = false;
    this._patDraft = "";
    this.isOpen = false;
    this.isVisible = true;
    this.activeTab = "overview";
    this.settingsSaving = false;
    this.settingsMessage = null;
    this.settingsDirty = false;
    this.pageMeta = { jobTitle: "", company: "", platform: "" };
    this.progress = { totalQuestions: 0, answeredQuestions: 0, profileAnswered: 0, aiAnswered: 0, manualAnswered: 0, pendingQuestions: 0 };
    this.profileData = {
      user: null,
      sections: [],
      answers: {},
      customQA: [],
      documents: {
        resume: { ready: false, filename: "", description: "Add a default resume to upload it automatically." },
        coverLetter: { ready: false, filename: "", description: "Add a saved cover letter to upload it automatically." }
      }
    };
    this.settingsDraft = cloneDraft(this.profileData);
    this.snappedEdge = "right";
    const initBm = this._bmSize();
    this.position = {
      x: this._bookmarkRightX(initBm.w),
      y: clamp(108, GUTTER, window.innerHeight - initBm.h - GUTTER)
    };
    this._dragState = null;
    this._mount();
  }
  _bmSize() {
    return { w: WHITE_SIDE + GRIP, h: WHITE_SIDE };
  }
  /** Fixed X for the bookmark so it stays flush to the right edge of the viewport. */
  _bookmarkRightX(bookmarkWidth) {
    const w = bookmarkWidth ?? this._bmSize().w;
    return Math.max(GUTTER, window.innerWidth - w - GUTTER);
  }
  _applyBookmarkLayout() {
    if (!this.bookmarkEl) return;
    const { w, h } = this._bmSize();
    this.bookmarkEl.style.width = `${w}px`;
    this.bookmarkEl.style.height = `${h}px`;
    this.bookmarkEl.classList.remove("aa-bookmark--edge-left", "aa-bookmark--edge-right", "aa-bookmark--edge-top", "aa-bookmark--edge-bottom");
    this.bookmarkEl.classList.add(`aa-bookmark--edge-${this.snappedEdge}`);
  }
  _markSettingsDirty() {
    var _a;
    if (this.activeTab !== "settings") return;
    this.settingsDirty = true;
    this.settingsMessage = null;
    const bar = (_a = this.panelEl) == null ? void 0 : _a.querySelector("#aa-settings-sticky");
    if (bar) bar.style.display = "flex";
  }
  _clearSettingsDirty() {
    var _a;
    this.settingsDirty = false;
    const bar = (_a = this.panelEl) == null ? void 0 : _a.querySelector("#aa-settings-sticky");
    if (bar) bar.style.display = "none";
  }
  _mount() {
    const style = document.createElement("style");
    style.textContent = `
      *,*::before,*::after{box-sizing:border-box}
      :host {
        --primary: #0066FF;
        --primary-bg: #EBF3FF;
        --secondary: #6366f1;
        --tertiary: #f59e0b;
        --success: #10b981;
        --danger: #ef4444;
        --background: #F8FAFC;
        --surface: #FFFFFF;
        --text: #1E293B;
        --text-muted: #64748B;
        --border: #E2E8F0;
        --radius-lg: 20px;
        --radius-md: 10px;
        --radius-ui: 8px;
        --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        --glass: rgba(255, 255, 255, 0.7);
      }
      .aa-bookmark,.aa-panel{position:fixed;z-index:2147483647;pointer-events:auto;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      h1, h2, h3, .headline { font-family: 'Manrope', system-ui, sans-serif; font-weight: 800; }
      
      /* Gradient "Aladdin AI" label in logs */
      .aa-ai-label{background:linear-gradient(90deg,#6366f1 0%,#a855f7 50%,#ec4899 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:600}
      /* Tick animation for completion */
      @keyframes aa-tick-pop{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:1}}
      .aa-tick-anim{animation:aa-tick-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both}

      .aa-bookmark{padding:0;background:transparent;pointer-events:auto;display:flex;align-items:stretch;border-radius:var(--radius-ui);box-shadow:0 6px 22px rgba(15,23,42,.12);overflow:hidden;border:1px solid #dbeafe}
      .aa-bookmark.state-running{box-shadow:0 0 0 2px var(--primary),0 6px 22px rgba(15,23,42,.12)}
      .aa-bookmark.state-paused{box-shadow:0 0 0 2px var(--tertiary),0 6px 22px rgba(15,23,42,.12)}
      .aa-bookmark.state-done{box-shadow:0 0 0 2px var(--success),0 6px 22px rgba(15,23,42,.12)}
      .aa-bookmark--edge-right{flex-direction:row}
      .aa-bookmark--edge-left{flex-direction:row}
      .aa-bookmark--edge-left .aa-bookmark-toggle{order:2}
      .aa-bookmark--edge-left .aa-bookmark-grip{order:1}
      .aa-bookmark--edge-top{flex-direction:column}
      .aa-bookmark--edge-top .aa-bookmark-toggle{order:2}
      .aa-bookmark--edge-top .aa-bookmark-grip{order:1}
      .aa-bookmark--edge-bottom{flex-direction:column}
      .aa-bookmark-toggle{flex:none;width:${WHITE_SIDE}px;height:${WHITE_SIDE}px;border:none;background:#fafbfc;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s ease,color .15s ease}
      .aa-bookmark-toggle:hover{background:#f1f5f9}
      .aa-bookmark-toggle img{width:36px;height:36px;object-fit:contain;display:block;pointer-events:none}
      .aa-bookmark-grip{flex-shrink:0;background:#2d3748;cursor:grab;display:flex;align-items:center;justify-content:center;touch-action:none;transition:background .15s ease}
      .aa-bookmark--edge-right .aa-bookmark-grip,.aa-bookmark--edge-left .aa-bookmark-grip{width:${GRIP}px;align-self:stretch;min-height:${WHITE_SIDE}px}
      .aa-bookmark--edge-top .aa-bookmark-grip,.aa-bookmark--edge-bottom .aa-bookmark-grip{width:100%;height:${GRIP}px}
      .aa-bookmark-grip:active{cursor:grabbing}
      .aa-bookmark-grip:hover{background:#1e293b}
      .aa-grip-dots{display:grid;grid-template-columns:repeat(2,5px);grid-template-rows:repeat(3,5px);gap:3px;place-content:center}
      .aa-bookmark--edge-top .aa-grip-dots,.aa-bookmark--edge-bottom .aa-grip-dots{grid-template-columns:repeat(3,5px);grid-template-rows:repeat(2,5px)}
      .aa-grip-dots span{width:4px;height:4px;border-radius:50%;background:#94a3b8;display:block}
      
      .aa-panel{width:372px;max-height:calc(100vh - ${PANEL_TOP_ANCHOR + GUTTER}px);display:flex;flex-direction:column;background:var(--background);border-radius:var(--radius-lg);box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;opacity:0;pointer-events:none;transition:opacity .18s ease; color:var(--text);border:1px solid var(--border)}
      .aa-panel.aa-panel--connect{
        background:var(--surface);
        border:none;
        box-shadow:0 24px 48px -14px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.045);
      }
      .aa-panel.open{opacity:1;pointer-events:auto}
      
      .aa-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--surface);cursor:grab;position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border)}
      .aa-header:active{cursor:grabbing}
      .aa-header-left{display:flex;align-items:center;gap:12px}
      .aa-header-left .logo-box{width:40px;height:40px;background:var(--primary-bg);border-radius:var(--radius-ui);display:flex;align-items:center;justify-content:center;box-shadow: inset 0 0 0 1px rgba(0,102,255,0.1);}
      .aa-header-left img{width:26px;height:26px;object-fit:contain;display:block}
      .aa-inline-icon{display:block;flex-shrink:0;pointer-events:none}
      .aa-nav-item .aa-inline-icon{width:22px;height:22px}
      .aa-icon-btn--img .aa-inline-icon{width:20px;height:20px}
      .aa-activity-header-icon .aa-inline-icon{width:22px;height:22px}
      .aa-doc-icon .aa-inline-icon{width:20px;height:20px}
      .aa-connect-btn-icon .aa-inline-icon{width:18px;height:18px}
      .aa-inline-icon--chevron{color:var(--primary)}
      .aa-header-left h1{font-size:18px;font-weight:800;margin:0;letter-spacing:-0.03em;color:var(--text)}
      .aa-header-right{display:flex;align-items:center;gap:8px}
      .aa-panel-close{appearance:none;border:none;background:transparent;width:34px;height:34px;border-radius:var(--radius-ui);cursor:pointer;color:var(--text-muted);font-size:20px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;padding:0}
      .aa-panel-close:hover{background:var(--background);color:var(--text)}
      .aa-header--connect{background:transparent;border-bottom:1px solid rgba(15,23,42,0.07);padding:12px 16px 14px}
      .aa-header--connect .logo-box{background:rgba(255,255,255,0.75);box-shadow:inset 0 0 0 1px rgba(0,102,255,0.12), 0 1px 2px rgba(15,23,42,0.04)}
      .aa-header--connect .aa-header-left h1{font-size:17px;letter-spacing:-0.035em;color:#0f172a}
      
      .aa-badge-ai{background:var(--tertiary);color:#fff;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:0.1em;box-shadow:0 0 12px rgba(245,158,11,0.3)}
      .aa-badge-user{width:36px;height:36px;border-radius:var(--radius-ui);background:var(--secondary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:none}
      
      .aa-body{flex:1;display:flex;flex-direction:column;gap:16px;padding:16px;overflow-y:auto}
      .aa-body::-webkit-scrollbar{width:6px}
      .aa-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}
      
      .aa-bottom-nav{display:flex;justify-content:space-around;align-items:center;padding:6px 6px;background:var(--surface);border-top:1px solid var(--border);position:relative;z-index:50;gap:4px}
      .aa-nav-item{appearance:none;border:none;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--text-muted);width:40px;height:40px;padding:0;transition:background .15s ease,color .15s ease;cursor:pointer;border-radius:var(--radius-ui)}
      .aa-nav-item .aa-inline-icon{opacity:0.5;transition:opacity .15s ease,color .15s ease}
      .aa-nav-item:hover .aa-inline-icon,.aa-nav-item.is-active .aa-inline-icon{opacity:1}
      .aa-nav-item:hover{color:var(--primary);background:var(--primary-bg)}
      .aa-nav-item.is-active{color:var(--primary);background:var(--primary-bg)}
      .aa-doc-row{display:flex;align-items:center;gap:10px;padding:12px 12px;border-radius:var(--radius-md);background:var(--background);border:1px solid var(--border)}
      .aa-doc-row .aa-doc-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-ui);background:var(--surface);border:1px solid var(--border)}
      .aa-doc-row .aa-doc-icon .aa-inline-icon{width:20px;height:20px;color:var(--primary)}
      .aa-doc-row .aa-doc-meta{flex:1;min-width:0}
      .aa-doc-row .aa-doc-name{font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
      .aa-doc-row .aa-doc-sub{font-size:10.5px;color:var(--text-muted);margin:3px 0 0}
      .btn-connect-pat{display:inline-flex;align-items:center;justify-content:center;gap:10px}
      .btn-connect-pat .aa-connect-btn-icon{display:flex;align-items:center;justify-content:center}
      .btn-connect-pat .aa-connect-btn-icon .aa-inline-icon{opacity:0.95;color:#fff}
      
      .bento{background:var(--surface);border-radius:var(--radius-md);padding:16px;border:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:border-color .15s ease,background .15s ease}
      .bento:hover{border-color:#cbd5e1}
      .bento-kicker{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin:0 0 8px}
      .bento-title{font-size:20px;font-weight:800;margin:0 0 10px;letter-spacing:-0.02em}
      
      .progress-container{margin-bottom:12px}
      .progress-label{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px}
      .progress-bar{height:8px;background:var(--background);border-radius:999px;overflow:hidden}
      .progress-fill{height:100%;background:linear-gradient(90deg, var(--primary), var(--secondary));border-radius:999px;transition:width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)}
      
      .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .stat-card{background:var(--surface);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border)}
      .stat-val{font-size:24px;font-weight:900;color:var(--text);display:block}
      .stat-label{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em}
      
      .btn-primary{width:100%;padding:10px 12px;background:var(--primary);color:#fff;border-radius:var(--radius-ui);border:none;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:background .15s ease,filter .15s ease;box-shadow:none}
      .btn-primary:hover{filter:brightness(1.06)}
      .btn-primary:active{filter:brightness(0.95)}
      .btn-secondary{width:100%;padding:10px 12px;background:var(--surface);color:var(--text);border-radius:var(--radius-ui);border:1px solid var(--border);font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
      .btn-secondary:hover{background:var(--primary-bg);border-color:var(--primary);color:var(--primary)}
      .aa-icon-btn{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--text);width:38px;height:38px;padding:0;border-radius:var(--radius-ui);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
      .aa-icon-btn:hover{background:var(--primary-bg);border-color:var(--primary);color:var(--primary)}
      .aa-icon-btn.aa-icon-btn--primary{background:var(--primary);color:#fff;border-color:var(--primary)}
      .aa-icon-btn.aa-icon-btn--primary:hover{filter:brightness(1.06);background:var(--primary);color:#fff;border-color:var(--primary)}
      .aa-icon-btn:disabled{opacity:0.5;cursor:not-allowed}
      .aa-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-start;margin-top:auto;padding-top:6px}
      
      .match-card{background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border);overflow:hidden;margin-bottom:12px;cursor:pointer;transition:border-color .15s ease,background .15s ease}
      .match-card:hover{border-color:var(--primary);background:#fafbfc}
      .match-top{padding:14px;display:flex;gap:12px;align-items:center}
      .match-logo{width:42px;height:42px;border-radius:12px;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
      .match-logo img{width:100%;height:100%;object-fit:contain}
      .match-info h3{font-size:14px;font-weight:800;margin:0 0 2px}
      .match-info p{font-size:12px;color:var(--text-muted);margin:0}
      .match-score{margin-left:auto;text-align:right}
      .match-score .val{display:block;font-size:16px;font-weight:900;color:var(--primary)}
      .match-score .lbl{font-size:10px;font-weight:800;text-transform:uppercase}
      .match-bottom{padding:8px 14px;background:rgba(248,250,252,0.5);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
      .match-tags{display:flex;gap:6px}
      .match-tag{font-size:10px;font-weight:800;padding:4px 8px;border-radius:6px;background:var(--background);color:var(--text-muted);text-transform:uppercase}
      
      .activity-item{display:grid;grid-template-columns:56px 1fr;gap:10px;margin-bottom:10px}
      .activity-time{font-size:11px;font-weight:800;color:var(--text-muted)}
      .activity-msg{font-size:12px;color:var(--text)}
      
      .aa-section{background:var(--surface);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:12px}
      .aa-fields{display:grid;gap:12px}
      .aa-field-label{font-size:12px;font-weight:800;color:var(--text);margin-bottom:5px;display:block}
      .aa-control{width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-ui);font-size:13px;background:var(--background);transition:border-color .15s ease,box-shadow .15s ease}
      .aa-control:focus{outline:none;border-color:var(--primary);background:var(--surface);box-shadow:0 0 0 3px var(--primary-bg)}
      
      .spotlight{background:linear-gradient(135deg, var(--primary), var(--secondary));color:#fff;padding:24px;border-radius:var(--radius-md);position:relative;overflow:hidden}
      .spotlight h3{font-size:20px;margin:0 0 8px}
      .spotlight p{font-size:13px;margin:0 0 16px;opacity:0.9;line-height:1.5}
      .spotlight-btn{background:#fff;color:var(--primary);padding:10px 18px;border-radius:var(--radius-ui);border:none;font-weight:700;font-size:13px;cursor:pointer;transition:filter .15s ease;display:inline-flex;align-items:center;gap:8px}
      .spotlight-btn:hover{filter:brightness(0.97)}
      .aa-connect-body{padding:16px 18px 20px;gap:0}
      .aa-connect-intro{margin-bottom:16px}
      .aa-connect-eyebrow{font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin:0 0 8px}
      .aa-connect-title{font-size:clamp(19px,4.4vw,23px);font-weight:800;letter-spacing:-0.035em;line-height:1.18;margin:0 0 10px;color:#0f172a}
      .aa-connect-lead{font-size:13px;line-height:1.55;margin:0;color:#475569;max-width:36ch}
      .aa-connect-steps-list{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:11px}
      .aa-connect-steps-list li{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.45;color:#334155;margin:0}
      .aa-connect-step-num{flex-shrink:0;width:22px;height:22px;border-radius:999px;background:rgba(0,102,255,0.1);color:var(--primary);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;margin-top:1px}
      .aa-connect-field{margin-bottom:14px}
      .aa-connect-label{display:block;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;margin:0 0 8px}
      .aa-connect-input{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.45;min-height:72px;resize:vertical;background:rgba(255,255,255,0.85);border-color:rgba(15,23,42,0.1);box-shadow:inset 0 1px 2px rgba(15,23,42,0.03)}
      .aa-connect-input:focus{background:#fff}
      .aa-connect-hint{font-size:11px;color:#94a3b8;margin:8px 0 0;line-height:1.4}
      .aa-connect-hint code{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(15,23,42,0.04);color:#475569}
      .aa-connect-error{font-size:12px;margin:0 0 12px;line-height:1.45;color:var(--danger);padding:10px 12px;border-radius:var(--radius-ui);background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15)}
      .aa-connect-actions{display:flex;flex-direction:column;gap:10px;margin-top:8px}
      .btn-connect-pat{width:100%;padding:11px 14px;background:var(--primary);color:#fff;border:none;border-radius:7px;font-weight:700;font-size:13px;letter-spacing:0.01em;cursor:pointer;transition:filter .15s ease,transform .12s ease;box-shadow:0 1px 0 rgba(255,255,255,0.12) inset, 0 2px 8px rgba(0,102,255,0.25)}
      .btn-connect-pat:hover{filter:brightness(1.05)}
      .btn-connect-pat:active{transform:translateY(1px)}
      .btn-connect-pat:disabled{opacity:0.55;cursor:not-allowed;transform:none;box-shadow:none}
      .btn-open-aladdin-secondary{width:100%;padding:10px 12px;background:rgba(255,255,255,0.65);color:#0f172a;border:1px solid rgba(15,23,42,0.1);border-radius:var(--radius-ui);font-weight:600;font-size:12.5px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease;box-shadow:0 1px 2px rgba(15,23,42,0.04)}
      .btn-open-aladdin-secondary:hover{background:#fff;border-color:rgba(0,102,255,0.35);color:var(--primary);box-shadow:0 2px 8px rgba(0,102,255,0.08)}
      .aa-settings-topbar{display:flex;justify-content:flex-end;align-items:center;margin:0 0 12px}
      #aa-settings-sticky{display:none;flex-direction:column;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
      .aa-activity-header-icon{display:flex;align-items:center;justify-content:center;color:var(--primary)}
      .aa-activity-header-icon .aa-inline-icon{opacity:0.85;color:var(--primary)}
      
      .pulsing-indicator{width:10px;height:10px;background:var(--success);border-radius:50%;display:inline-block;margin-right:8px;position:relative}
      .pulsing-indicator::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:var(--success);opacity:0.4;animation:pulse-dot 1.5s infinite}
      @keyframes pulse-dot{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}
    `;
    this.shadowRoot.appendChild(style);
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    this.bookmarkEl = document.createElement("div");
    this.panelEl = document.createElement("section");
    this.shadowRoot.appendChild(this.bookmarkEl);
    this.shadowRoot.appendChild(this.panelEl);
    this._bindGlobals();
    this._renderBookmark();
    this._renderPanel();
    this._syncVisibility();
    this._place();
  }
  _bindGlobals() {
    this._onPointerMove = (event) => {
      if (!this._dragState || event.pointerId !== this._dragState.pointerId) return;
      const dx = event.clientX - this._dragState.startX;
      const dy = event.clientY - this._dragState.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this._dragState.moved = true;
      const { w, h } = this._bmSize();
      this.position = {
        x: this._bookmarkRightX(w),
        y: clamp(this._dragState.originY + dy, GUTTER, window.innerHeight - h - GUTTER)
      };
      this._place();
    };
    this._onPointerUp = (event) => {
      if (!this._dragState || event.pointerId !== this._dragState.pointerId) return;
      const dragState = this._dragState;
      this._dragState = null;
      if (dragState.source === "grip") {
        this._snapBookmarkToRightWall();
      }
    };
    this._onResize = () => {
      const { w, h } = this._bmSize();
      this.position = {
        x: this._bookmarkRightX(w),
        y: clamp(this.position.y, GUTTER, window.innerHeight - h - GUTTER)
      };
      this._place();
    };
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("resize", this._onResize);
  }
  _startDrag(event, source) {
    if (event.button !== 0 || !this.isVisible) return;
    this._dragState = {
      pointerId: event.pointerId,
      source,
      startX: event.clientX,
      startY: event.clientY,
      originX: this.position.x,
      originY: this.position.y,
      moved: false
    };
    event.preventDefault();
  }
  _total() {
    return Math.max(this.progress.totalQuestions || 0, 0);
  }
  _answered() {
    return clamp(this.progress.answeredQuestions || 0, 0, this._total());
  }
  _percent() {
    const total = this._total();
    return total ? Math.round(this._answered() / total * 100) : 0;
  }
  _filledSettingsCount() {
    const answers = Object.values(this.profileData.answers ?? {}).filter((value) => typeof value === "string" && value.trim()).length;
    const custom = (this.profileData.customQA ?? []).filter((entry) => {
      var _a;
      return (_a = entry == null ? void 0 : entry.answer) == null ? void 0 : _a.trim();
    }).length;
    return answers + custom;
  }
  _snapBookmarkToRightWall() {
    const H = window.innerHeight;
    const { w, h } = this._bmSize();
    this.snappedEdge = "right";
    this.position = {
      x: this._bookmarkRightX(w),
      y: clamp(this.position.y, GUTTER, H - h - GUTTER)
    };
    this._applyBookmarkLayout();
    this._place();
  }
  _place() {
    const { w: bmW, h: bmH } = this._bmSize();
    const bx = this._bookmarkRightX(bmW);
    const by = clamp(this.position.y, GUTTER, window.innerHeight - bmH - GUTTER);
    this.position = { x: bx, y: by };
    this.bookmarkEl.style.left = `${bx}px`;
    this.bookmarkEl.style.top = `${by}px`;
    const bmMidX = bx + bmW / 2;
    const openLeft = bmMidX < window.innerWidth / 2;
    const px = openLeft ? GUTTER : window.innerWidth - PANEL_WIDTH - GUTTER;
    const py = PANEL_TOP_ANCHOR;
    this.panelEl.style.left = `${px}px`;
    this.panelEl.style.top = `${py}px`;
    this.panelEl.style.transformOrigin = openLeft ? "16px 20px" : `calc(100% - 16px) 20px`;
  }
  _syncVisibility() {
    this.bookmarkEl.hidden = !this.isVisible;
    this.panelEl.hidden = !this.isVisible;
    if (!this.isVisible) this.panelEl.classList.remove("open");
  }
  _bookmarkAriaDetail() {
    const total = this._total();
    let s = this._stateLabel();
    if (total) s += `. ${this._answered()} of ${total} questions filled`;
    return s;
  }
  _stateLabel() {
    if (this.askingQuestion) return "Needs input";
    return { idle: "Ready to fill", running: "Filling page...", paused: "Check required", done: "Page filled" }[this.state] ?? "Ready to fill";
  }
  _resumeFileLabel() {
    var _a;
    const doc = (_a = this.profileData.documents) == null ? void 0 : _a.resume;
    const name = typeof (doc == null ? void 0 : doc.filename) === "string" ? doc.filename.trim() : "";
    if (name) return name;
    if (doc == null ? void 0 : doc.ready) return "Saved resume";
    return "No resume saved yet";
  }
  _coverFileLabel() {
    var _a;
    const doc = (_a = this.profileData.documents) == null ? void 0 : _a.coverLetter;
    const name = typeof (doc == null ? void 0 : doc.filename) === "string" ? doc.filename.trim() : "";
    if (name) return name;
    if (doc == null ? void 0 : doc.ready) return "Saved cover letter";
    return "No cover letter saved yet";
  }
  _overviewHtml() {
    const userName = this.profileData.user ? [this.profileData.user.firstName, this.profileData.user.lastName].filter(Boolean).join(" ").trim() : "Job Hunter";
    return `
      <section>
        <p class="bento-kicker">Dashboard overview</p>
        <h2 class="bento-title">Hi, ${this._esc(userName)}!</h2>
        <div class="bento">
          <div class="progress-label">
            <span>Profile Completion</span>
            <span style="color:var(--primary)">85%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width: 85%"></div></div>
          <p style="font-size:12px;color:var(--text-muted);margin:12px 0 0">Syncing your latest <strong>Senior Developer</strong> persona.</p>
        </div>
      </section>

      <section>
        <button type="button" class="btn-primary" id="aa-start" title="Auto apply this page" aria-label="Auto apply this page">Auto apply</button>
      </section>

      <section class="grid-2">
        <div class="stat-card">
          <span class="stat-label">Applications</span>
          <strong class="stat-val">124</strong>
        </div>
         <div class="stat-card">
          <span class="stat-label">Offers</span>
          <strong class="stat-val" style="color:var(--success)">2</strong>
        </div>
      </section>

      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 class="headline" style="font-size:18px;margin:0">Recent Matches</h2>
          <span style="color:var(--primary);font-size:12px;font-weight:800;cursor:pointer">See all</span>
        </div>
        
        <div class="match-card">
          <div class="match-top">
            <div class="match-logo"><img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD3VBToBsql5kgau4oJE5b8dOCqU6b0pjPt-f5idgEKRPTvmiWwH1mZgdc1AOAzJ55ORsHLIxl0VLBbx3Zz_9jncetRPRerHW_x2Q6Qiov0MUBd8CCurR3JeeWeRxaJS5kdu0miY7N32vgNWsVtTIUH3QuvSM-kxWZ8u3ZPTShKJO6LplSMOtyv9O_mdmmXilDzkI52IZFabYfCehlkxpiauJhyWW1ZgpYYBawogNvcp8UwjLEX-EQrCNDm5ve1S7G5j6HkaBEOlA" alt="Spotify"></div>
            <div class="match-info">
              <h3>Senior UI Engineer</h3>
              <p>Spotify • Remote</p>
            </div>
            <div class="match-score"><span class="val">98%</span><span class="lbl">Match</span></div>
          </div>
          <div class="match-bottom">
            <div class="match-tags"><span class="match-tag">Full-time</span></div>
            <span class="aa-inline-icon--chevron" aria-hidden="true">${inlineIcons.chevronRight(18)}</span>
          </div>
        </div>
      </section>

    `;
  }
  _applicationsHtml() {
    return `
      <section class="bento">
        <p class="bento-kicker">Live Application</p>
        <h2 class="bento-title">${this._esc(this._stateLabel())}</h2>
        <div class="progress-label">
          <span>${this._answered()} of ${this._total()} questions</span>
          <span style="color:var(--primary)">${this._percent()}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${this._percent()}%"></div></div>
      </section>

      <section class="bento">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="aa-activity-header-icon" title="Activity" aria-hidden="true">${inlineIcons.activity(24)}</div>
          <span class="pulsing-indicator" title="Live updates" aria-label="Live"></span>
        </div>
        <div class="aa-activity">
          ${this.logEntries.length ? this.logEntries.slice(-8).reverse().map((entry) => {
      var _a;
      const time = ((_a = entry.match(/\[(.*?)\]/)) == null ? void 0 : _a[1]) || "--:--";
      const msg = entry.replace(/\[.*?\]\s*/, "");
      const escapedMsg = this._esc(msg).replace(/Aladdin AI/g, '<span class="aa-ai-label">Aladdin AI</span>');
      return `<div class="activity-item"><span class="activity-time">${this._esc(time)}</span><span class="activity-msg">${escapedMsg}</span></div>`;
    }).join("") : '<p style="color:var(--text-muted);font-size:13px;font-style:italic">Waiting to start application...</p>'}
        </div>
      </section>
      
      ${this._fileAlertBanner() || ""}
      ${this._prompt() || ""}
      ${this._success() || ""}

      <div class="aa-toolbar" role="toolbar" aria-label="Autofill controls">
        ${this.state === "paused" ? `<button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-resume" title="Resume" aria-label="Resume autofill">${inlineIcons.play(22)}</button>` : `<button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-pause" title="Pause" aria-label="Pause autofill">${inlineIcons.pause(22)}</button>`}
        <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-toolbar-skip" title="Skip" aria-label="Skip step">${inlineIcons.skip(22)}</button>
        <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-stop" title="Stop" aria-label="Stop autofill">${inlineIcons.stop(22)}</button>
      </div>
    `;
  }
  _fieldHtml(field) {
    var _a;
    const id = `aa-field-${field.key}`;
    const value = ((_a = this.settingsDraft.answers) == null ? void 0 : _a[field.key]) ?? "";
    if (field.type === "select") {
      return `
        <div class="aa-field-wrap">
          <label class="aa-field-label" for="${id}">${this._esc(field.label)}</label>
          <select class="aa-control" id="${id}" data-aa-field-key="${this._esc(field.key)}">
            <option value="">Select an option</option>
            ${(field.options ?? []).map((option) => `<option value="${this._esc(option)}"${option === value ? " selected" : ""}>${this._esc(option)}</option>`).join("")}
          </select>
        </div>
      `;
    }
    if (field.type === "textarea") {
      return `
        <div class="aa-field-wrap">
          <label class="aa-field-label" for="${id}">${this._esc(field.label)}</label>
          <textarea class="aa-control" id="${id}" data-aa-field-key="${this._esc(field.key)}" style="min-height:80px;resize:vertical" placeholder="${this._esc(field.placeholder || "")}">${this._esc(value)}</textarea>
        </div>
      `;
    }
    return `
      <div class="aa-field-wrap">
        <label class="aa-field-label" for="${id}">${this._esc(field.label)}</label>
        <input class="aa-control" id="${id}" type="${this._esc(field.type || "text")}" data-aa-field-key="${this._esc(field.key)}" value="${this._esc(value)}" placeholder="${this._esc(field.placeholder || "")}">
      </div>
    `;
  }
  _customAnswersHtml() {
    var _a;
    if (!((_a = this.settingsDraft.customQA) == null ? void 0 : _a.length)) {
      return '<p style="color:var(--text-muted);font-size:13px;font-style:italic">No custom answers yet. Add them below to remember weird questions.</p>';
    }
    return this.settingsDraft.customQA.map((entry, index) => `
      <div class="bento" style="margin-bottom:12px;background:var(--background)">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="aa-field-label" style="margin:0">Custom Question #${index + 1}</span>
          <span data-aa-remove-custom="${index}" style="color:var(--danger);cursor:pointer;display:inline-flex;align-items:center" title="Remove">${inlineIcons.delete(18)}</span>
        </div>
        <input class="aa-control" type="text" data-aa-custom-index="${index}" data-aa-custom-prop="question" value="${this._esc(entry.question)}" placeholder="The question asked..." style="margin-bottom:8px">
        <textarea class="aa-control" data-aa-custom-index="${index}" data-aa-custom-prop="answer" placeholder="Your remembered answer..." style="min-height:60px">${this._esc(entry.answer)}</textarea>
      </div>
    `).join("");
  }
  _settingsHtml() {
    var _a;
    const stickyDisplay = this.settingsDirty ? "flex" : "none";
    const resume = (_a = this.profileData.documents) == null ? void 0 : _a.resume;
    const resumeReady = !!(resume == null ? void 0 : resume.ready);
    return `
      <section>
        <div class="aa-settings-topbar">
          <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-settings-reload" title="Reload from server" aria-label="Reload settings from server">${inlineIcons.refresh(22)}</button>
        </div>
        <p class="bento-kicker">Profile Settings</p>
        <h2 class="bento-title">Customize Flow</h2>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Automation</h3>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none">
            <span style="font-size:13px;color:var(--text);flex:1;line-height:1.4">
              <strong>Auto-Advance</strong><br>
              <span style="color:var(--text-muted)">Automatically click Next after all fields on a step are filled. Blocks if mandatory fields are empty.</span>
            </span>
            <input type="checkbox" id="aa-auto-advance-toggle" ${this.autoAdvance ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--brand,#6366f1);cursor:pointer;flex-shrink:0">
          </label>
        </div>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Aladdin account</h3>
          ${this.profileData.user ? `
            <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;line-height:1.45">
              Connected as <strong>${this._esc(this.profileData.user.email || `${this.profileData.user.firstName || ""} ${this.profileData.user.lastName || ""}`.trim() || "your account")}</strong>.
            </p>
            <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-disconnect-aladdin" title="Sign out" aria-label="Sign out and disconnect extension" style="border-color:var(--danger);color:var(--danger)">${inlineIcons.signOut(22)}</button>
          ` : `
            <p style="font-size:13px;color:var(--text-muted);margin:0;line-height:1.45">Not connected. Generate a secret key in Aladdin → Account → Auto Apply, then paste it in the extension bookmark (overview when disconnected).</p>
          `}
        </div>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Resume</h3>
          <div class="aa-doc-row">
            <div class="aa-doc-icon" aria-hidden="true">${inlineIcons.document(22)}</div>
            <div class="aa-doc-meta">
              <p class="aa-doc-name">${this._esc(this._resumeFileLabel())}</p>
              <p class="aa-doc-sub">Used when applications ask for a résumé file.</p>
            </div>
            ${resumeReady ? `<button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-resume-preview" title="Preview resume" aria-label="Preview resume">${inlineIcons.preview(20)}</button>` : ""}
          </div>
        </div>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Cover letter</h3>
          <p class="aa-doc-sub" style="margin:0 0 12px">${this._esc(this._coverFileLabel())}</p>
          <button type="button" class="btn-secondary" id="aa-generate-cover-letter" style="width:100%;text-align:center">Generate cover letter using Aladdin</button>
        </div>
        
        ${(this.profileData.sections ?? []).map((section) => `
          <div class="aa-section">
            <h3 class="headline" style="font-size:16px;margin:0 0 16px">${this._esc(section.title)}</h3>
            <div class="aa-fields">${section.fields.map((f) => this._fieldHtml(f)).join("")}</div>
          </div>
        `).join("")}

        <div class="aa-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 class="headline" style="font-size:16px;margin:0">Custom QA</h3>
            <button type="button" class="aa-icon-btn" id="aa-add-custom" title="Add custom Q and A" aria-label="Add custom question and answer">
              ${inlineIcons.add(22)}
            </button>
          </div>
          ${this._customAnswersHtml()}
        </div>

        ${this.settingsMessage ? `<p style="font-size:12px;margin:-4px 0 12px;color:var(--text-muted)">${this._esc(this.settingsMessage.text)}</p>` : ""}
        <div id="aa-settings-sticky" style="display:${stickyDisplay}">
           <div style="font-size:12px;color:var(--text-muted)">You have unsaved changes.</div>
           <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
            <button type="button" class="aa-icon-btn aa-icon-btn--primary" id="aa-settings-save" title="${this.settingsSaving ? "Saving" : "Save"}" aria-label="${this.settingsSaving ? "Saving settings" : "Save settings"}" ${this.settingsSaving ? "disabled" : ""}>
              ${this.settingsSaving ? inlineIcons.hourglass(22) : inlineIcons.save(22)}
            </button>
           </div>
        </div>
      </section>
    `;
  }
  _fileAlertBanner() {
    if (!this.fileAlert) return "";
    return `
      <div class="bento" style="background:#fff7ed;border-color:#f59e0b;display:flex;align-items:flex-start;gap:10px">
        <span style="color:#f59e0b;flex-shrink:0;margin-top:1px">${inlineIcons.document(20)}</span>
        <p style="font-size:12px;color:#92400e;margin:0;line-height:1.5">${this._esc(this.fileAlert)}</p>
      </div>
    `;
  }
  _prompt() {
    if (!this.askingQuestion) return "";
    return `
      <section class="bento" style="background:var(--primary-bg);border-color:var(--primary)">
        <h3 class="headline" style="font-size:18px;margin:0 0 12px;color:var(--primary)">User Input Required</h3>
        <p style="font-size:14px;font-weight:600;margin:0 0 16px">${this._esc(this.askingQuestion.label)}</p>
        ${this.askingQuestion.type === "file" ? `
           <label class="aa-icon-btn" style="margin-bottom:12px;cursor:pointer;width:100%;box-sizing:border-box" title="Choose file" aria-label="Choose file to upload">
             ${inlineIcons.uploadFile(22)}
             <input type="file" id="aa-prompt-file-input" style="display:none">
           </label>
        ` : `
          <input class="aa-control" id="aa-prompt-answer" type="text" placeholder="Type here..." style="margin-bottom:12px">
        `}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">
          <button type="button" class="aa-icon-btn" style="width:100%" id="aa-prompt-save" title="Submit" aria-label="Submit answer">
            ${inlineIcons.check(22)}
          </button>
          <button type="button" class="aa-icon-btn" style="width:100%" id="aa-prompt-skip" title="Skip" aria-label="Skip question">
            ${inlineIcons.skipNext(22)}
          </button>
        </div>
      </section>
    `;
  }
  _success() {
    if (this.state !== "done") return "";
    const allAnswered = !this._total() || this._answered() >= this._total();
    const label = allAnswered ? "All questions filled!" : `${this._answered()} of ${this._total()} questions filled`;
    const sub = allAnswered ? "Review your answers and submit the application." : "A few fields need manual review. Check the page before submitting.";
    return `
      <div class="bento" style="background:#ecfbf3;border-color:var(--success);text-align:center">
        <span class="aa-tick-anim" style="color:var(--success);display:flex;justify-content:center;margin-bottom:12px">${inlineIcons.checkCircle(48)}</span>
        <h3 class="headline" style="font-size:20px;margin:0 0 8px;color:#166d48">${label}</h3>
        <p style="font-size:13px;color:#166d48;margin:0">${sub}</p>
      </div>
    `;
  }
  _renderBookmark() {
    this.bookmarkEl.className = `aa-bookmark state-${this.state}${this.isOpen ? " is-open" : ""}`;
    const dots = '<span class="aa-grip-dots">' + Array.from({ length: 6 }, () => "<span></span>").join("") + "</span>";
    const ariaToggle = `Open Aladdin. ${this._bookmarkAriaDetail()}`;
    this.bookmarkEl.innerHTML = `
      <button type="button" class="aa-bookmark-toggle">
        <img src="${LOGO_URL}" alt="">
      </button>
      <div class="aa-bookmark-grip" role="button" tabindex="0" aria-label="Drag to move anywhere. Release to snap to the nearest screen edge." title="Drag to move the widget anywhere on the page. Release to snap to the nearest edge.">
        ${dots}
      </div>
    `;
    const toggle = this.bookmarkEl.querySelector(".aa-bookmark-toggle");
    const grip = this.bookmarkEl.querySelector(".aa-bookmark-grip");
    if (toggle) {
      toggle.setAttribute("aria-label", ariaToggle);
      toggle.onclick = (e) => {
        e.stopPropagation();
        if (this.isOpen) this.collapse();
        else this.open();
      };
    }
    if (grip) {
      grip.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e, "grip");
      };
    }
    this._applyBookmarkLayout();
  }
  _renderPanel() {
    var _a, _b;
    this.panelEl.className = `aa-panel state-${this.state}${this.isOpen ? " open" : ""}${!((_a = this.profileData) == null ? void 0 : _a.user) ? " aa-panel--connect" : ""}`;
    if (!((_b = this.profileData) == null ? void 0 : _b.user)) {
      this.panelEl.innerHTML = `
        <div class="aa-header aa-header--connect" id="aa-header-drag">
          <div class="aa-header-left">
            <div class="logo-box"><img src="${LOGO_URL}" alt="Aladdin"></div>
            <h1 class="headline">Aladdin</h1>
          </div>
          <button type="button" class="aa-panel-close" id="aa-panel-close" title="Close" aria-label="Close panel">×</button>
        </div>
        <div class="aa-body aa-connect-body">
          <div class="aa-connect-intro">
            <p class="aa-connect-eyebrow">Auto Apply</p>
            <h2 class="aa-connect-title headline">Connect this extension</h2>
            <p class="aa-connect-lead">One secret key links your browser to Aladdin so applications can fill safely—nothing is stored in the page.</p>
          </div>
          <ol class="aa-connect-steps-list" aria-label="Steps to connect">
            <li><span class="aa-connect-step-num" aria-hidden="true">1</span><span>Open Aladdin in your browser and sign in.</span></li>
            <li><span class="aa-connect-step-num" aria-hidden="true">2</span><span>Go to <strong>Settings</strong> → <strong>Auto Apply</strong> and generate an <strong>extension secret key</strong>.</span></li>
            <li><span class="aa-connect-step-num" aria-hidden="true">3</span><span>Paste the key in the field, then tap <strong>Connect</strong>. Use <strong>Open Aladdin</strong> at the bottom if you still need the site.</span></li>
          </ol>
          <div class="aa-connect-field">
            <label class="aa-connect-label" for="aa-pat-input">Extension secret key</label>
            <textarea class="aa-control aa-connect-input" id="aa-pat-input" rows="3" placeholder="ald_ext_…" spellcheck="false" autocomplete="off"></textarea>
            <p class="aa-connect-hint">Keys usually start with <code>ald_ext_</code></p>
          </div>
          ${this.patConnectError ? `<p class="aa-connect-error" role="alert">${this._esc(this.patConnectError)}</p>` : ""}
          <div class="aa-connect-actions">
            <button type="button" class="btn-connect-pat" id="aa-pat-connect" title="${this.patConnectBusy ? "Connecting" : "Connect with secret key"}" aria-label="${this.patConnectBusy ? "Connecting" : "Connect extension"}" ${this.patConnectBusy ? "disabled" : ""}>${this.patConnectBusy ? "Connecting…" : `<span class="aa-connect-btn-icon">${inlineIcons.connect(18)}</span>Connect`}</button>
            <button type="button" class="btn-open-aladdin-secondary" id="aa-open-aladdin" title="Open Aladdin" aria-label="Open Aladdin in a new tab">Open Aladdin</button>
          </div>
        </div>
      `;
      this._bindPanelEvents();
      this._syncVisibility();
      this._place();
      return;
    }
    if (this.pageMeta.platform === "generic") {
      this.panelEl.innerHTML = `
        <div class="aa-header" id="aa-header-drag">
           <div class="aa-header-left">
            <div class="logo-box"><img src="${LOGO_URL}" alt="Aladdin"></div>
            <h1 class="headline">Aladdin</h1>
          </div>
          <button type="button" class="aa-panel-close" id="aa-panel-close" title="Close" aria-label="Close panel">×</button>
        </div>
        <div class="aa-body">
           <div class="bento" style="text-align:center;padding:40px 20px">
            <span style="display:flex;justify-content:center;color:var(--text-muted);margin-bottom:16px">${inlineIcons.block(48)}</span>
            <h3 class="headline">Site Not Supported</h3>
            <p style="color:var(--text-muted);font-size:13px">Auto-apply is not enabled for this site. Navigate to a supported job board to see Aladdin in action.</p>
          </div>
        </div>
        <nav class="aa-bottom-nav">
          <button type="button" class="aa-nav-item is-active" id="aa-tab-overview" title="Home" aria-label="Home">${inlineIcons.home(24)}</button>
        </nav>
      `;
      this._bindPanelEvents();
      this._syncVisibility();
      this._place();
      return;
    }
    let innerContent = this._overviewHtml();
    if (this.activeTab === "applications" || this.state === "running" && this.activeTab !== "settings") {
      innerContent = this._applicationsHtml();
    } else if (this.activeTab === "settings") {
      innerContent = this._settingsHtml();
    }
    this.panelEl.innerHTML = `
      <div class="aa-header" id="aa-header-drag">
        <div class="aa-header-left">
          <div class="logo-box"><img src="${LOGO_URL}" alt="Aladdin"></div>
          <h1 class="headline">Aladdin</h1>
        </div>
        <div class="aa-header-right">
          <button type="button" class="aa-panel-close" id="aa-panel-close" title="Close" aria-label="Close panel">×</button>
        </div>
      </div>
      
      <div class="aa-body">
        ${innerContent}
      </div>

      <nav class="aa-bottom-nav">
        <button type="button" class="aa-nav-item ${this.activeTab === "overview" ? "is-active" : ""}" id="aa-tab-overview" title="Home" aria-label="Home">${inlineIcons.home(24)}</button>
        <button type="button" class="aa-nav-item ${this.activeTab === "applications" ? "is-active" : ""}" id="aa-tab-applications" title="Activity" aria-label="Activity">${inlineIcons.activity(24)}</button>
        <button type="button" class="aa-nav-item ${this.activeTab === "settings" ? "is-active" : ""}" id="aa-tab-settings" title="Settings" aria-label="Settings">${inlineIcons.settings(24)}</button>
      </nav>
    `;
    this._bindPanelEvents();
    this._syncVisibility();
    this._place();
  }
  _bindPanelEvents() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u;
    const patInput = this.panelEl.querySelector("#aa-pat-input");
    if (patInput) {
      patInput.value = this._patDraft;
      patInput.addEventListener("input", () => {
        this._patDraft = patInput.value;
      });
    }
    (_a = this.panelEl.querySelector("#aa-pat-connect")) == null ? void 0 : _a.addEventListener("click", () => {
      var _a2;
      const input = this.panelEl.querySelector("#aa-pat-input");
      this._patDraft = (input == null ? void 0 : input.value) ?? this._patDraft;
      (_a2 = this.onConnectPat) == null ? void 0 : _a2.call(this, this._patDraft);
    });
    (_b = this.panelEl.querySelector("#aa-open-aladdin")) == null ? void 0 : _b.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onOpenAladdin) == null ? void 0 : _a2.call(this);
    });
    const closeBtn = this.panelEl.querySelector("#aa-panel-close");
    closeBtn == null ? void 0 : closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.collapse();
    });
    closeBtn == null ? void 0 : closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    (_c = this.panelEl.querySelector("#aa-sign-in")) == null ? void 0 : _c.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onSignIn) == null ? void 0 : _a2.call(this);
    });
    (_d = this.panelEl.querySelector("#aa-header-drag")) == null ? void 0 : _d.addEventListener("pointerdown", (event) => this._startDrag(event, "panel"));
    (_e = this.panelEl.querySelector("#aa-tab-overview")) == null ? void 0 : _e.addEventListener("click", () => this._switchTab("overview"));
    (_f = this.panelEl.querySelector("#aa-tab-applications")) == null ? void 0 : _f.addEventListener("click", () => this._switchTab("applications"));
    (_g = this.panelEl.querySelector("#aa-tab-settings")) == null ? void 0 : _g.addEventListener("click", () => this._switchTab("settings"));
    (_h = this.panelEl.querySelector("#aa-start")) == null ? void 0 : _h.addEventListener("click", () => {
      var _a2;
      this.activeTab = "applications";
      (_a2 = this.onStart) == null ? void 0 : _a2.call(this);
    });
    (_i = this.panelEl.querySelector("#aa-pause")) == null ? void 0 : _i.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onPause) == null ? void 0 : _a2.call(this);
    });
    (_j = this.panelEl.querySelector("#aa-resume")) == null ? void 0 : _j.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onResume) == null ? void 0 : _a2.call(this);
    });
    (_k = this.panelEl.querySelector("#aa-toolbar-skip")) == null ? void 0 : _k.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onSkip) == null ? void 0 : _a2.call(this);
    });
    (_l = this.panelEl.querySelector("#aa-stop")) == null ? void 0 : _l.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onStop) == null ? void 0 : _a2.call(this);
    });
    (_m = this.panelEl.querySelector("#aa-disconnect-aladdin")) == null ? void 0 : _m.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onDisconnect) == null ? void 0 : _a2.call(this);
    });
    (_n = this.panelEl.querySelector("#aa-settings-save")) == null ? void 0 : _n.addEventListener("click", () => {
      var _a2;
      return (_a2 = this.onSaveSettings) == null ? void 0 : _a2.call(this, this.getSettingsDraft());
    });
    (_o = this.panelEl.querySelector("#aa-settings-reload")) == null ? void 0 : _o.addEventListener("click", () => {
      this._clearSettingsDirty();
      this._syncDraft();
      this.setSettingsMessage("Settings reloaded.", "info");
      this._renderPanel();
    });
    const autoAdvanceToggle = this.panelEl.querySelector("#aa-auto-advance-toggle");
    if (autoAdvanceToggle) {
      autoAdvanceToggle.addEventListener("change", () => {
        var _a2;
        this.autoAdvance = autoAdvanceToggle.checked;
        (_a2 = this.onAutoAdvanceChange) == null ? void 0 : _a2.call(this, this.autoAdvance);
      });
    }
    (_p = this.panelEl.querySelector("#aa-generate-cover-letter")) == null ? void 0 : _p.addEventListener("click", () => {
      this.addLog("Generate cover letter — coming soon.");
    });
    (_q = this.panelEl.querySelector("#aa-resume-preview")) == null ? void 0 : _q.addEventListener("click", () => {
      if (typeof this.onResumePreview === "function") {
        this.onResumePreview();
      } else {
        this.addLog("Resume preview is not available yet.");
      }
    });
    (_r = this.panelEl.querySelector("#aa-add-custom")) == null ? void 0 : _r.addEventListener("click", () => {
      this.settingsDraft.customQA.push({ question: "", answer: "" });
      this.settingsDirty = true;
      this.settingsMessage = null;
      this._renderPanel();
    });
    this.panelEl.querySelectorAll("[data-aa-remove-custom]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.getAttribute("data-aa-remove-custom"), 10);
        if (!isNaN(index)) {
          this.settingsDraft.customQA.splice(index, 1);
          this.settingsDirty = true;
          this.settingsMessage = null;
          this._renderPanel();
        }
      });
    });
    this.panelEl.querySelectorAll("[data-aa-field-key]").forEach((control) => {
      const sync = () => {
        this.settingsDraft.answers[control.getAttribute("data-aa-field-key")] = control.value;
        this._markSettingsDirty();
      };
      control.addEventListener("input", sync);
      control.addEventListener("change", sync);
    });
    this.panelEl.querySelectorAll("[data-aa-custom-index]").forEach((control) => {
      const sync = () => {
        const index = parseInt(control.getAttribute("data-aa-custom-index"), 10);
        const prop = control.getAttribute("data-aa-custom-prop");
        if (isNaN(index) || !prop) return;
        this.settingsDraft.customQA[index][prop] = control.value;
        this._markSettingsDirty();
      };
      control.addEventListener("input", sync);
      control.addEventListener("change", sync);
    });
    (_s = this.panelEl.querySelector("#aa-prompt-save")) == null ? void 0 : _s.addEventListener("click", () => {
      var _a2, _b2;
      const value = (_b2 = (_a2 = this.panelEl.querySelector("#aa-prompt-answer")) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim();
      if (value) this._resolvePrompt(value);
    });
    (_t = this.panelEl.querySelector("#aa-prompt-skip")) == null ? void 0 : _t.addEventListener("click", () => this._resolvePrompt(null));
    (_u = this.panelEl.querySelector("#aa-prompt-file-input")) == null ? void 0 : _u.addEventListener("change", (event) => {
      var _a2;
      const file = (_a2 = event.target.files) == null ? void 0 : _a2[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        var _a3;
        const result = (_a3 = loadEvent.target) == null ? void 0 : _a3.result;
        const base64 = typeof result === "string" ? result.split(",")[1] : "";
        if (base64) this._resolvePrompt(base64);
      };
      reader.readAsDataURL(file);
    });
  }
  _switchTab(tab) {
    var _a;
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this._renderPanel();
    if (tab === "settings") (_a = this.onOpenSettings) == null ? void 0 : _a.call(this);
  }
  _resolvePrompt(value) {
    if (typeof this._resolveAsking === "function") this._resolveAsking(value);
  }
  _syncDraft() {
    this.settingsDraft = cloneDraft(this.profileData);
  }
  setProfileData(profileData) {
    this.profileData = {
      user: (profileData == null ? void 0 : profileData.user) ?? null,
      sections: Array.isArray(profileData == null ? void 0 : profileData.sections) ? profileData.sections : [],
      answers: { ...(profileData == null ? void 0 : profileData.answers) ?? {} },
      customQA: Array.isArray(profileData == null ? void 0 : profileData.customQA) ? profileData.customQA.map((entry) => ({
        question: typeof (entry == null ? void 0 : entry.question) === "string" ? entry.question : "",
        answer: typeof (entry == null ? void 0 : entry.answer) === "string" ? entry.answer : ""
      })) : [],
      documents: (profileData == null ? void 0 : profileData.documents) ?? this.profileData.documents
    };
    this._syncDraft();
    this.settingsDirty = false;
    this._renderPanel();
  }
  setSettingsSaving(isSaving) {
    this.settingsSaving = !!isSaving;
    this._renderPanel();
  }
  setSettingsMessage(text, tone = "info") {
    this.settingsMessage = text ? { text, tone } : null;
    this._renderPanel();
  }
  setJobMeta(jobTitle2, company2, platform2 = this.pageMeta.platform) {
    this.pageMeta = { jobTitle: jobTitle2 || "", company: company2 || "", platform: platform2 || "" };
    this._renderPanel();
  }
  setPlatform(platform2) {
    this.pageMeta.platform = platform2 || "";
    this._renderPanel();
  }
  setProgress(progress) {
    this.progress = { ...this.progress, ...progress };
    this._renderBookmark();
    this._renderPanel();
  }
  resetSession() {
    this.logEntries = [];
    this.answers = [];
    this.askingQuestion = null;
    this.activeTab = "overview";
    this.progress = { totalQuestions: 0, answeredQuestions: 0 };
    this._renderBookmark();
    this._renderPanel();
  }
  setState(state) {
    this.state = state;
    this._renderBookmark();
    this._renderPanel();
  }
  showFileAlert(message) {
    this.fileAlert = typeof message === "string" ? message : "A file upload is required on this page.";
    this._renderPanel();
  }
  hideFileAlert() {
    this.fileAlert = null;
    this._renderPanel();
  }
  addLog(message) {
    const time = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: false });
    this.logEntries.push(`[${time}] ${message}`);
    this._renderPanel();
  }
  addAnswer(question, answer) {
    if (!this.answers.find((entry) => entry.question === question)) this.answers.push({ question, answer });
  }
  getAnswers() {
    return this.answers;
  }
  getSettingsDraft() {
    return {
      sections: this.profileData.sections,
      answers: { ...this.settingsDraft.answers ?? {} },
      customQA: (this.settingsDraft.customQA ?? []).map((entry) => ({
        question: typeof (entry == null ? void 0 : entry.question) === "string" ? entry.question : "",
        answer: typeof (entry == null ? void 0 : entry.answer) === "string" ? entry.answer : ""
      }))
    };
  }
  askUser(label, type = "text") {
    return new Promise((resolve) => {
      this.askingQuestion = { label, type };
      this.activeTab = "applications";
      this.show();
      this.open();
      this._resolveAsking = (value) => {
        this.askingQuestion = null;
        this._resolveAsking = null;
        this._renderPanel();
        resolve(value);
      };
      this._renderPanel();
    });
  }
  celebrateSuccess() {
    fireConfetti(this.shadowRoot);
  }
  open() {
    if (!this.isVisible) return;
    this.isOpen = true;
    this.panelEl.classList.add("open");
    this._renderBookmark();
    this._place();
  }
  collapse() {
    this.isOpen = false;
    this.panelEl.classList.remove("open");
    this._renderBookmark();
  }
  show() {
    this.isVisible = true;
    this._syncVisibility();
    this._place();
    this._renderBookmark();
  }
  hide() {
    this.isVisible = false;
    this.collapse();
    this._syncVisibility();
  }
  getSnapshot() {
    return {
      visible: this.isVisible,
      open: this.isOpen,
      state: this.state,
      jobTitle: this.pageMeta.jobTitle,
      company: this.pageMeta.company,
      platform: this.pageMeta.platform,
      progress: { ...this.progress },
      requiresInput: !!this.askingQuestion,
      activeTab: this.activeTab
    };
  }
  _esc(value) {
    if (value === null || value === void 0) return "";
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }
}
let host = null;
let shadow = null;
let panel$1 = null;
function injectPanel() {
  if (panel$1) return panel$1;
  host = document.createElement("div");
  host.id = "autoapply-root";
  host.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 0px !important;
    height: 0px !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: none !important;
    opacity: 1 !important;
    visibility: visible !important;
    display: block !important;
    transform: none !important;
    isolation: isolate !important;
    contain: none !important;
  `;
  document.documentElement.appendChild(host);
  shadow = host.attachShadow({ mode: "closed" });
  const styleReset = document.createElement("style");
  styleReset.textContent = `
    :host {
      all: initial !important;
      display: block !important;
    }
  `;
  shadow.appendChild(styleReset);
  panel$1 = new AutoApplyPanel(shadow);
  const observer = new MutationObserver(() => {
    if (host && host.parentNode !== document.documentElement) {
      document.documentElement.appendChild(host);
    }
    if (host && (host.style.display === "none" || host.style.visibility === "hidden")) {
      host.style.display = "block";
      host.style.visibility = "visible";
    }
  });
  observer.observe(document.documentElement, { childList: true, attributes: true, subtree: false });
  return panel$1;
}
function removePanel() {
  host == null ? void 0 : host.remove();
  host = null;
  shadow = null;
  panel$1 = null;
}
function getJobMeta() {
  return parseJobMeta();
}
function installErrorBoundary() {
  window.addEventListener("error", (event) => {
    if (event.error && isFatalExtensionError(event.error)) {
      event.preventDefault();
      performGhostCleanup();
      return true;
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason && isFatalExtensionError(event.reason)) {
      event.preventDefault();
      performGhostCleanup();
    }
  });
}
function performGhostCleanup() {
  var _a;
  try {
    removePanel();
  } catch {
  }
  try {
    (_a = document.getElementById("autoapply-root")) == null ? void 0 : _a.remove();
  } catch {
  }
}
function scanFields(platform2, onNewFields) {
  const fields = collectFields();
  if (["workday", "lever", "ashby", "generic", "generic-weak"].includes(platform2)) {
    let lastFieldCount = fields.length;
    const observer = new MutationObserver(() => {
      const updated = collectFields();
      const visibleCount = updated.filter((f) => {
        var _a;
        return (_a = f.element) == null ? void 0 : _a.isConnected;
      }).length;
      if (lastFieldCount > 1 && visibleCount <= 1) {
        setTimeout(() => {
          const afterSettle = collectFields();
          lastFieldCount = afterSettle.length;
          onNewFields(afterSettle);
        }, 800);
        return;
      }
      lastFieldCount = updated.length;
      onNewFields(updated);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window._autoapplyObserver = observer;
  }
  return fields;
}
function stopObserver() {
  var _a;
  (_a = window._autoapplyObserver) == null ? void 0 : _a.disconnect();
  delete window._autoapplyObserver;
}
async function scrollFieldIntoView(el) {
  return new Promise((resolve) => {
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
    }
    setTimeout(resolve, 300);
  });
}
async function retryFailedFields(failedFields2, fillFn, maxRetries = 3) {
  const delays = [500, 1e3, 2e3];
  let remaining = [...failedFields2];
  for (let attempt = 0; attempt < maxRetries && remaining.length > 0; attempt++) {
    await new Promise((r) => setTimeout(r, delays[attempt] ?? 2e3));
    const stillFailing = [];
    for (const field of remaining) {
      const ok = await fillFn(field);
      if (!ok) stillFailing.push(field);
    }
    remaining = stillFailing;
  }
  return remaining;
}
function getShadowRoot(el) {
  var _a;
  try {
    if (el.shadowRoot) return el.shadowRoot;
    if (typeof ((_a = chrome == null ? void 0 : chrome.dom) == null ? void 0 : _a.openOrClosedShadowRoot) === "function") {
      return chrome.dom.openOrClosedShadowRoot(el) ?? null;
    }
  } catch {
  }
  return null;
}
function collectFields() {
  const seen = /* @__PURE__ */ new WeakSet();
  const platform2 = detectPlatform();
  const results = [];
  _walkRoot(document, results, seen, platform2, 0);
  return results;
}
const MAX_SHADOW_DEPTH = 5;
function _walkRoot(root, results, seen, platform2, depth) {
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [role="combobox"], [role="listbox"]'
  );
  for (const el of candidates) {
    if (seen.has(el)) continue;
    if (el.type === "hidden" || el.getAttribute("aria-hidden") === "true") continue;
    try {
      if (el.tagName === "IFRAME" && el.contentDocument === null) continue;
    } catch {
      continue;
    }
    if (!isVisible$1(el)) continue;
    seen.add(el);
    results.push({
      element: el,
      type: getFieldType(el),
      label: getLabelText(el, platform2),
      placeholder: el.placeholder ?? el.getAttribute("placeholder") ?? "",
      name: el.name ?? el.getAttribute("name") ?? "",
      ariaLabel: el.getAttribute("aria-label") ?? "",
      context: getContext(el),
      maxLength: el.maxLength > 0 ? el.maxLength : null,
      platform: platform2,
      selectOptions: collectFieldOptions(el)
    });
  }
  const fileInputs = root.querySelectorAll('input[type="file"]');
  for (const el of fileInputs) {
    if (seen.has(el)) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    if (el.disabled) continue;
    seen.add(el);
    results.push({
      element: el,
      type: "file",
      label: getLabelText(el, platform2) || guessUploadLabelFromContext(el),
      placeholder: el.getAttribute("placeholder") ?? "",
      name: el.name ?? el.getAttribute("name") ?? "",
      ariaLabel: el.getAttribute("aria-label") ?? "",
      context: getUploadContext(el),
      maxLength: null,
      platform: platform2,
      selectOptions: []
    });
  }
  if (depth < MAX_SHADOW_DEPTH) {
    const allEls = root.querySelectorAll("*");
    for (const el of allEls) {
      const shadow2 = getShadowRoot(el);
      if (!shadow2) continue;
      if (seen.has(shadow2)) continue;
      seen.add(shadow2);
      _walkRoot(shadow2, results, seen, platform2, depth + 1);
    }
  }
}
function collectFieldOptions(el) {
  var _a;
  if (el.tagName === "SELECT") {
    return Array.from(el.options).filter((o) => !o.disabled && (o.text || "").trim().length > 0).filter((o) => !(o.value === "" && /^(select|choose|please|--)/i.test((o.text || "").trim()))).map((o) => ({ value: o.value, text: (o.text || o.value || "").trim() }));
  }
  const listId = (_a = el.getAttribute) == null ? void 0 : _a.call(el, "list");
  if (listId && el.tagName === "INPUT") {
    const dl = document.getElementById(listId);
    if (dl) {
      return Array.from(dl.querySelectorAll("option")).map((o) => {
        var _a2;
        return {
          value: o.value || ((_a2 = o.textContent) == null ? void 0 : _a2.trim()) || "",
          text: (o.textContent || o.value || "").trim()
        };
      }).filter((o) => o.text.length > 0);
    }
  }
  return [];
}
function detectPlatform() {
  const host2 = window.location.hostname;
  if (host2.includes("chatgpt.com") || host2.includes("google.com") || host2.includes("localhost")) {
    return "generic";
  }
  if (host2.includes("greenhouse.io")) return "greenhouse";
  if (host2.includes("lever.co")) return "lever";
  if (host2.includes("myworkdayjobs.com")) return "workday";
  if (host2.includes("ashbyhq.com")) return "ashby";
  if (document.querySelector("[data-gh-id]")) return "greenhouse";
  return "generic";
}
function getFieldType(el) {
  if (el.tagName === "TEXTAREA") return "textarea";
  if (el.tagName === "SELECT") return "select";
  if (el.getAttribute("role") === "combobox") return "select";
  if (el.getAttribute("role") === "listbox") return "select";
  if (el.getAttribute("aria-haspopup") === "listbox") return "select";
  if (el.getAttribute("type")) return el.getAttribute("type");
  return "text";
}
function isVisible$1(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  if (style.display !== "none" && (el.id || el.name)) return true;
  return rect.width > 0 && rect.height > 0;
}
function getLabelText(el, platform2) {
  var _a, _b, _c, _d, _e, _f, _g;
  const root = el.getRootNode && el.getRootNode() instanceof ShadowRoot ? el.getRootNode() : document;
  if (el.id) {
    const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`) ?? document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return ((_a = label.textContent) == null ? void 0 : _a.trim()) ?? "";
  }
  if (platform2 === "workday") {
    const wdContainer = el.closest('[data-automation-id="formField"]');
    if (wdContainer) {
      const label = wdContainer.querySelector("label");
      if (label) return ((_b = label.textContent) == null ? void 0 : _b.trim()) ?? "";
    }
  }
  if (platform2 === "greenhouse") {
    const ghField = el.closest(".field, .field-wrapper, [data-gh-id]");
    if (ghField) {
      const label = ghField.querySelector("label, .label, .field-label");
      if (label) {
        return ((_c = label.textContent) == null ? void 0 : _c.replace(/\(Required\)$/i, "").replace(/\*$/, "").trim()) ?? "";
      }
    }
  }
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ((_d = ref.textContent) == null ? void 0 : _d.trim()) ?? "";
  }
  const parent = el.closest("label");
  if (parent) return ((_e = parent.textContent) == null ? void 0 : _e.trim()) ?? "";
  const prev = el.previousElementSibling;
  if (prev && prev.tagName === "LABEL") return ((_f = prev.textContent) == null ? void 0 : _f.trim()) ?? "";
  let current = el.parentElement;
  for (let i = 0; i < 3 && current; i++) {
    const label = current.querySelector("label, span.label, .label");
    if (label) return ((_g = label.textContent) == null ? void 0 : _g.trim()) ?? "";
    current = current.parentElement;
  }
  return "";
}
function getContext(el) {
  var _a;
  const container = el.closest('fieldset, [role="group"], .field, .form-group, li, div') ?? el.parentElement;
  return ((_a = container == null ? void 0 : container.textContent) == null ? void 0 : _a.replace(/\s+/g, " ").trim().slice(0, 300)) ?? "";
}
function getUploadContext(el) {
  var _a, _b;
  const container = el.closest(
    'fieldset, [role="group"], .field, .form-group, [data-automation-id="formField"], [data-testid*="upload"], [class*="upload"], li, div'
  ) ?? el.parentElement;
  const text = ((_a = container == null ? void 0 : container.textContent) == null ? void 0 : _a.replace(/\s+/g, " ").trim()) ?? "";
  if (text.length >= 12) return text.slice(0, 300);
  let current = (container == null ? void 0 : container.parentElement) ?? el.parentElement;
  for (let i = 0; i < 5 && current; i++) {
    const t = ((_b = current.textContent) == null ? void 0 : _b.replace(/\s+/g, " ").trim()) ?? "";
    if (t.length >= 12) return t.slice(0, 300);
    current = current.parentElement;
  }
  return text.slice(0, 300);
}
function guessUploadLabelFromContext(el) {
  const ctx = getUploadContext(el).toLowerCase();
  if (/\b(resume|cv|curriculum vitae)\b/.test(ctx)) return "Resume/CV";
  if (/\bcover letter\b/.test(ctx)) return "Cover letter";
  if (/\bportfolio\b/.test(ctx)) return "Portfolio";
  if (/\btranscript\b/.test(ctx)) return "Transcript";
  return "File upload";
}
function matchFieldToProfile(fieldMeta, profile2) {
  const text = buildFieldText(fieldMeta);
  const { user, onboardingAnswers, userContext = {} } = profile2;
  if (matches(text, ["first name", "firstname", "first_name", "given name"])) return (user == null ? void 0 : user.firstName) ?? null;
  if (matches(text, ["last name", "lastname", "last_name", "surname", "family name"])) return (user == null ? void 0 : user.lastName) ?? null;
  if (matches(text, ["email", "e-mail", "email address"])) return (user == null ? void 0 : user.email) ?? null;
  const customContextAnswer = matchUserContext(text, userContext);
  if (customContextAnswer) {
    return customContextAnswer;
  }
  const getAA = (key) => {
    var _a;
    if (typeof userContext[key] === "string" && userContext[key].trim()) {
      return userContext[key];
    }
    return ((_a = onboardingAnswers == null ? void 0 : onboardingAnswers.find((a) => a.questionKey === key)) == null ? void 0 : _a.answerText) ?? null;
  };
  if (isPhoneCountryCodeFieldText(text)) return getAA("aa_phone_country_code");
  if (matches(text, ["phone device", "device type", "type of phone", "phone type"])) {
    return getAA("aa_phone_device_type");
  }
  if (matches(text, ["phone", "mobile", "telephone", "cell"])) return getAA("aa_phone");
  if (matches(text, ["how did you hear", "hear about us", "how did you find", "where did you hear", "source of hire", "referral source", "how did you learn", "about this job", "about this role", "about this position"]) && !matches(text, ["specify", "explain", "describe", "detail", "if other", "please list"])) {
    return "Other";
  }
  if (matches(text, ["if other", "please specify", "please explain", "please describe", "additional detail"]) && matches(text, ["hear", "referral", "source", "opening", "opportunity", "position", "job", "about"])) {
    return getAA("aa_hear_about_other_detail") || "aladdin";
  }
  if (matches(text, ["previously been employed", "previously employed", "ever been employed by", "ever worked for", "have you ever worked for", "have you worked for"]) || matches(text, ["previously"]) && matches(text, ["employ"]) || matches(text, ["current teammate", "current teammates", "internal workday", "internal jobs report", "apply via your internal"])) {
    if (matches(text, ["employ", "company", "minor", "teammate", "internal", "worked", "by", "?"])) return "No";
  }
  if (matches(text, ["linkedin", "linkedin url", "linkedin profile", "urls[LinkedIn]"])) return getAA("aa_linkedin_url");
  if (matches(text, ["github", "github url", "github profile", "urls[GitHub]"])) return getAA("aa_github_url");
  if (matches(text, ["portfolio", "website", "personal site", "portfolio url", "urls[Portfolio]"])) return getAA("aa_portfolio_url");
  if (matches(text, ["twitter", "x.com"])) return getAA("aa_twitter_url");
  if (matches(text, ["authorized to work", "legally authorized", "work authorization"])) return "Yes";
  if (matches(text, ["right to work", "eligible to work", "permitted to work"])) return "Yes";
  if (matches(text, ["national of", "citizen of", "residing in this country"])) return "Yes";
  if (matches(text, ["sponsorship", "require visa", "need sponsorship", "visa sponsorship required"])) return "No";
  if (matches(text, ["willing to relocate", "open to relocat", "relocation"])) return "Yes";
  if (matches(text, ["willing to travel", "open to travel", "travel required"])) return "Yes";
  if (matches(text, ["available to work", "available to start", "ready to start"])) return "Yes";
  if (matches(text, ["work full time", "full-time", "full time basis"])) return "Yes";
  if (matches(text, ["work on-site", "work onsite", "work in office", "in-office", "on site"])) return "Yes";
  if (matches(text, ["accommodate"])) return "Yes";
  if (matches(text, ["background check", "background screening", "criminal check"])) return "Yes";
  if (matches(text, ["drug test", "drug screen", "substance test"])) return "Yes";
  if (matches(text, ["street", "address", "line 1"])) return getAA("aa_address");
  if (matches(text, ["city", "town"])) return getAA("aa_city");
  if (matches(text, ["state", "province", "region"])) return getAA("aa_state");
  if (matches(text, ["zip", "postal", "postal code", "zip code"])) return getAA("aa_zip");
  if (matches(text, ["country"]) && !isPhoneCountryCodeFieldText(text)) return getAA("aa_country");
  if (matches(text, ["current title", "job title", "current position", "most recent title", "org_title"])) return getAA("aa_current_title");
  if (matches(text, ["current company", "current employer", "org", "organization"])) return getAA("aa_current_company");
  if (matches(text, ["years of experience", "years experience", "how many years"])) return getAA("aa_years_experience");
  if (matches(text, ["education", "degree", "highest degree", "educational background"])) return getAA("aa_education_level");
  if (matches(text, ["gender"])) return getAA("aa_gender");
  if (matches(text, ["pronoun"])) return getAA("aa_pronouns");
  if (matches(text, ["ethnicity", "race"]) && !matches(text, ["hispanic"])) return getAA("aa_ethnicity");
  if (matches(text, ["hispanic", "latino"])) return getAA("aa_hispanic");
  if (matches(text, ["veteran"])) return getAA("aa_veteran_status");
  if (matches(text, ["disability"])) return getAA("aa_disability");
  if (matches(text, ["lgbtq", "sexual orientation"])) return getAA("aa_lgbtq");
  if (matches(text, ["clearance"])) return getAA("aa_clearance");
  return null;
}
function matches(text, patterns) {
  const t = text.toLowerCase();
  return patterns.some((p) => t.includes(p.toLowerCase()));
}
function matchUserContext(text, userContext) {
  for (const [key, value] of Object.entries(userContext ?? {})) {
    if (key.startsWith("aa_custom_") && value && typeof value === "object") {
      const questionLabel = value.questionLabel ?? "";
      const answerValue = value.value ?? "";
      if (questionLabel && typeof answerValue === "string" && matches(text, [questionLabel])) {
        return answerValue;
      }
      continue;
    }
    if (key.startsWith("aa_")) {
      continue;
    }
    if (typeof value === "string" && matches(text, [key])) {
      return value;
    }
  }
  return null;
}
function buildFieldText(fieldMeta) {
  return [fieldMeta.label, fieldMeta.placeholder, fieldMeta.name, fieldMeta.ariaLabel].filter(Boolean).join(" ").toLowerCase();
}
const PHONE_COUNTRY_CODE_PATTERNS = [
  "country code",
  "calling code",
  "dial code",
  "dialing code",
  "international code",
  "intl code",
  "phone country",
  "mobile country",
  "telephone country",
  "isd",
  "idd",
  "countrycallingcode",
  "phoneprefix",
  "country_prefix"
];
function isPhoneCountryCodeFieldText(text) {
  const t = text.toLowerCase();
  if (matches(t, PHONE_COUNTRY_CODE_PATTERNS)) return true;
  if (t.includes("code") && (t.includes("phone") || t.includes("mobile") || t.includes("cell") || t.includes("tel")))
    return true;
  return false;
}
function getAAField(profile2, key) {
  var _a;
  const { onboardingAnswers = [], userContext = {} } = profile2 || {};
  if (typeof userContext[key] === "string" && userContext[key].trim()) return userContext[key].trim();
  const row = onboardingAnswers.find((a) => a.questionKey === key);
  return ((_a = row == null ? void 0 : row.answerText) == null ? void 0 : _a.trim()) || null;
}
function fuzzyMatchFieldToProfile(fieldMeta, profile2) {
  const text = buildFieldText(fieldMeta);
  const FUZZY_TOKEN_MAP = [
    { tokens: ["phone", "device"], key: "aa_phone_device_type" },
    { tokens: ["years", "experience"], key: "aa_years_experience" },
    { tokens: ["current", "title"], key: "aa_current_title" },
    { tokens: ["current", "company"], key: "aa_current_company" },
    { tokens: ["current", "employer"], key: "aa_current_company" },
    { tokens: ["highest", "degree"], key: "aa_education_level" },
    { tokens: ["highest", "education"], key: "aa_education_level" },
    { tokens: ["linkedin", "profile"], key: "aa_linkedin_url" },
    { tokens: ["linkedin", "url"], key: "aa_linkedin_url" },
    { tokens: ["github", "profile"], key: "aa_github_url" },
    { tokens: ["github", "url"], key: "aa_github_url" },
    { tokens: ["phone", "number"], key: "aa_phone" },
    { tokens: ["mobile", "number"], key: "aa_phone" },
    { tokens: ["zip", "code"], key: "aa_zip" },
    { tokens: ["postal", "code"], key: "aa_zip" },
    { tokens: ["street", "address"], key: "aa_address" },
    { tokens: ["work", "authorization"], value: "Yes" },
    { tokens: ["authorized", "work"], value: "Yes" },
    { tokens: ["visa", "sponsorship"], value: "No" },
    { tokens: ["require", "sponsorship"], value: "No" },
    { tokens: ["willing", "relocate"], value: "Yes" },
    { tokens: ["open", "relocation"], value: "Yes" },
    { tokens: ["willing", "travel"], value: "Yes" },
    { tokens: ["background", "check"], value: "Yes" },
    { tokens: ["drug", "test"], value: "Yes" },
    { tokens: ["portfolio", "url"], key: "aa_portfolio_url" },
    { tokens: ["portfolio", "website"], key: "aa_portfolio_url" },
    { tokens: ["gender", "identity"], key: "aa_gender" },
    { tokens: ["race", "ethnicity"], key: "aa_ethnicity" },
    { tokens: ["veteran", "status"], key: "aa_veteran_status" },
    { tokens: ["disability", "status"], key: "aa_disability" },
    { tokens: ["citizenship", "country"], key: "aa_citizenship_country" },
    { tokens: ["security", "clearance"], key: "aa_clearance" }
  ];
  for (const { tokens, key, value } of FUZZY_TOKEN_MAP) {
    if (tokens.every((t) => text.includes(t))) {
      if (value !== void 0) return value;
      if (key) {
        const v = getAAField(profile2, key);
        if (v) return v;
      }
    }
  }
  return null;
}
function extractSchoolNameFromProfile(profile2) {
  var _a;
  if (!profile2) return null;
  const { onboardingAnswers = [], userContext = {}, resume } = profile2;
  for (const a of onboardingAnswers) {
    const ql = (a.questionLabel || "").toLowerCase();
    const qk = (a.questionKey || "").toLowerCase();
    if (/(university|college|school|institution)/.test(ql) || /(university|school|college|institution)/.test(qk)) {
      const t = (_a = a.answerText) == null ? void 0 : _a.trim();
      if (t) return t;
    }
  }
  for (const [k, value] of Object.entries(userContext || {})) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (/(university|school|college|institution)/i.test(k)) return value.trim();
  }
  const pj = resume == null ? void 0 : resume.parsedJson;
  if (pj && typeof pj === "object") {
    const ed = pj.education ?? pj.educations;
    if (Array.isArray(ed) && ed.length) {
      const e0 = ed[0];
      if (e0 && typeof e0 === "object") {
        const name = e0.institution ?? e0.school ?? e0.university ?? e0.name ?? e0.schoolName;
        if (typeof name === "string" && name.trim()) return name.trim();
      }
    }
  }
  return null;
}
function inferSelectHintFromProfile(fieldMeta, profile2) {
  if (!profile2) return null;
  const text = buildFieldText(fieldMeta);
  if (isPhoneCountryCodeFieldText(text)) {
    const v = getAAField(profile2, "aa_phone_country_code");
    if (v) return v;
  }
  const school = extractSchoolNameFromProfile(profile2);
  if (school && matches(text, ["university", "college", "school", "institution", "enrolled", "campus"])) {
    return school;
  }
  if (matches(text, ["gender"])) return getAAField(profile2, "aa_gender");
  if (matches(text, ["pronoun"])) return getAAField(profile2, "aa_pronouns");
  if (matches(text, ["ethnicity", "race"]) && !matches(text, ["hispanic"])) {
    return getAAField(profile2, "aa_ethnicity");
  }
  if (matches(text, ["hispanic", "latino"])) return getAAField(profile2, "aa_hispanic");
  if (matches(text, ["veteran"])) return getAAField(profile2, "aa_veteran_status");
  if (matches(text, ["disability"])) return getAAField(profile2, "aa_disability");
  if (matches(text, ["lgbtq", "sexual orientation"])) return getAAField(profile2, "aa_lgbtq");
  if (matches(text, ["education level", "highest degree", "degree level"])) {
    return getAAField(profile2, "aa_education_level");
  }
  if (matches(text, ["citizenship country", "country of citizenship"])) {
    return getAAField(profile2, "aa_citizenship_country");
  }
  if (matches(text, ["country"]) && matches(text, ["citizen"])) {
    return getAAField(profile2, "aa_citizenship_country");
  }
  if (matches(text, ["willing to relocate", "relocation"])) {
    return getAAField(profile2, "aa_willing_to_relocate");
  }
  if (matches(text, ["clearance"])) return getAAField(profile2, "aa_clearance");
  if (matches(text, ["how did you hear", "hear about us", "referral source", "where did you hear"]) && !matches(text, ["specify", "explain", "describe", "if other"])) {
    return "Other";
  }
  return null;
}
const PREFIX_STRIP = [
  /^(yes|no)[,.\s]+/i,
  /^(yes,?\s*)?i\s*(?:'m|am)\s+(?:currently\s+)?(?:enrolled|studying|a student)\s+(?:at|in)\s+/i,
  /^(?:my\s+(?:university|school|college)\s+(?:is|was)\s+)/i,
  /^(?:i\s+(?:attend|attended)\s+)/i
];
function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?'"]/g, "").trim();
}
function tokenSet(s) {
  return new Set(
    norm(s).split(/\s+/).filter((w) => w.length > 1)
  );
}
function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
function dialDigits(s) {
  const d = String(s || "").replace(/\D/g, "");
  if (!d) return "";
  return d.replace(/^0+/, "") || "0";
}
function scoreDialCodeHint(hint, optionText) {
  const h = String(hint || "").trim();
  const o = String(optionText || "");
  let bonus = 0;
  const hd = dialDigits(h);
  if (hd.length >= 1 && hd.length <= 4) {
    const od = dialDigits(o);
    if (od.startsWith(hd) || hd === od || o.replace(/\s/g, "").includes(`+${hd}`)) bonus += 480;
    if (o.includes(`+${hd}`)) bonus += 120;
  }
  const iso = h.match(/\b([a-z]{2})\b/i);
  if (iso && iso[1]) {
    const code = iso[1].toUpperCase();
    if (new RegExp(`\\b${code}\\b`).test(o)) bonus += 420;
  }
  return bonus;
}
function extractHintCandidates(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const out = /* @__PURE__ */ new Set();
  out.add(s);
  let stripped = s;
  for (const re of PREFIX_STRIP) {
    stripped = stripped.replace(re, "").trim();
  }
  if (stripped.length >= 2) out.add(stripped);
  for (const part of s.split(/(?:\n|\.|;)\s+/)) {
    const p = part.trim();
    if (p.length >= 2) out.add(p);
  }
  const quoted = s.match(/"([^"]{2,120})"|'([^']{2,120})'/);
  if (quoted) out.add((quoted[1] || quoted[2]).trim());
  const leadingYesNo = s.match(/^(yes|no|maybe|true|false)\b/i);
  if (leadingYesNo) out.add(leadingYesNo[1]);
  const afterPreamble = s.match(
    /\b(?:start|available|pursue|pursuing|enrolled|degree|graduated?)\s+(?:in\s+|as\s+|a\s+|an\s+|the\s+|full-time\s+)?(.{2,40})$/i
  );
  if (afterPreamble) {
    const tail = afterPreamble[1].replace(/[.,;!?]+$/, "").trim();
    if (tail.length >= 2) out.add(tail);
  }
  const monthYear = s.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i
  );
  if (monthYear) out.add(monthYear[0]);
  const SYNONYMS = {
    // Gender
    male: ["man", "male", "mr"],
    man: ["male", "man"],
    female: ["woman", "female", "ms", "mrs"],
    woman: ["female", "woman"],
    "non-binary": ["non-binary", "nonbinary", "non binary", "enby", "genderqueer", "gender non-conforming"],
    nonbinary: ["non-binary", "nonbinary", "non binary"],
    "gender non-conforming": ["non-binary", "nonbinary", "gender non-conforming", "genderqueer"],
    genderqueer: ["non-binary", "nonbinary", "genderqueer"],
    // Race / ethnicity
    asian: ["asian", "asian american", "asian / pacific islander", "asian or pacific islander"],
    black: ["black", "african american", "black or african american", "black / african american"],
    "african american": ["black", "african american", "black or african american"],
    hispanic: ["hispanic", "latino", "latina", "hispanic or latino", "hispanic / latino"],
    latino: ["hispanic", "latino", "hispanic or latino"],
    white: ["white", "caucasian", "white / caucasian"],
    caucasian: ["white", "caucasian"],
    "native american": ["native american", "american indian", "indigenous", "american indian or alaska native"],
    // Veteran status
    veteran: ["veteran", "i am a veteran", "protected veteran", "i identify as a veteran"],
    "not a veteran": ["not a veteran", "i am not a protected veteran", "i do not identify as a protected veteran"],
    // Disability
    "no disability": ["no", "no, i do not have a disability", "i do not have a disability", "not disabled"],
    "has disability": ["yes", "yes, i have a disability", "i have a disability"],
    // Yes / No normalisation
    yes: ["yes", "true", "i am", "i do", "i have", "i will"],
    no: ["no", "false", "i am not", "i do not", "i will not", "i have not"],
    // Country name synonyms
    "united states": ["united states", "united states of america", "us", "usa", "u.s.", "u.s.a."],
    "usa": ["united states", "united states of america", "us", "usa"],
    "us": ["united states", "united states of america", "us", "usa"],
    "uk": ["united kingdom", "great britain", "england", "uk", "u.k."],
    "united kingdom": ["united kingdom", "great britain", "uk", "u.k."],
    "canada": ["canada", "ca"],
    "india": ["india", "in"],
    "australia": ["australia", "au"],
    "germany": ["germany", "deutschland", "de"],
    "france": ["france", "fr"]
  };
  const sLower = s.trim().toLowerCase();
  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (sLower === key || syns.includes(sLower)) {
      for (const syn of syns) out.add(syn);
      break;
    }
  }
  return [...out];
}
function scorePair(hint, optionText) {
  const h = norm(hint);
  const o = norm(optionText);
  if (!h || !o) return 0;
  let base = 0;
  if (h === o) base = 1e3;
  else if (h.includes(o)) base = 800 + Math.min(o.length, 80);
  else if (o.includes(h)) base = 700 + Math.min(h.length, 80);
  else {
    const hNoSpace = h.replace(/\s+/g, "");
    const oNoSpace = o.replace(/\s+/g, "");
    if (hNoSpace === oNoSpace) base = 950;
    else if (oNoSpace.includes(hNoSpace)) base = 750 + Math.min(hNoSpace.length, 80);
    else if (hNoSpace.includes(oNoSpace)) base = 700 + Math.min(oNoSpace.length, 80);
    else base = jaccard(hint, optionText) * 380;
  }
  return base + scoreDialCodeHint(hint, optionText);
}
function matchHintToSelectOption(hint, options) {
  var _a;
  if (!hint || !(options == null ? void 0 : options.length)) return null;
  const candidates = extractHintCandidates(hint);
  let best = null;
  let bestScore = 0;
  for (const opt of options) {
    const text = ((_a = opt.text) == null ? void 0 : _a.trim()) || "";
    const val = opt.value != null ? String(opt.value).trim() : "";
    if (!text && !val) continue;
    for (const c of candidates) {
      const scText = text ? scorePair(c, text) : 0;
      const scVal = val ? scorePair(c, val) : 0;
      const sc = Math.max(scText, scVal);
      if (sc > bestScore) {
        bestScore = sc;
        best = opt;
      }
    }
  }
  if (bestScore >= 150) return best;
  const polarityResult = tryPolarityFallback(hint, options);
  if (polarityResult) return polarityResult;
  return null;
}
const NEGATIVE_RE = /\b(no\b|not\b|don'?t|won'?t|can'?t|cannot|never|without|no need|unnecessary|will not|do not|does not|have not|has not|didn'?t|wouldn'?t|shouldn'?t|unable|unauthorized|ineligible)\b/i;
const YES_OPTION_RE = /^(yes|true|1|confirm|i will|i am|i have|i do)\b/i;
const NO_OPTION_RE = /^(no|false|0|not applicable|i will not|i do not|i won'?t)\b/i;
function tryPolarityFallback(hint, options) {
  if (!hint || !(options == null ? void 0 : options.length)) return null;
  const yesOpts = options.filter((o) => YES_OPTION_RE.test((o.text || "").trim()));
  const noOpts = options.filter((o) => NO_OPTION_RE.test((o.text || "").trim()));
  if (!yesOpts.length || !noOpts.length) return null;
  if (yesOpts.length + noOpts.length !== options.length) return null;
  const isNegative = NEGATIVE_RE.test(hint);
  const bucket = isNegative ? noOpts : yesOpts;
  if (bucket.length === 1) return bucket[0];
  let pick = bucket[0];
  let topScore = 0;
  for (const opt of bucket) {
    const sc = jaccard(hint, opt.text || "") * 380;
    if (sc > topScore) {
      topScore = sc;
      pick = opt;
    }
  }
  return pick;
}
const FALLBACK_RES = [
  /\bother\b/i,
  /\bothers?\b/i,
  /none of (the )?above/i,
  /not (listed|applicable)/i,
  /does not apply/i,
  /n\/a\b/i,
  /prefer not to say/i,
  /decline to state/i,
  /not available/i
];
function pickFallbackSelectOption(options) {
  if (!(options == null ? void 0 : options.length)) return null;
  for (const re of FALLBACK_RES) {
    const hit = options.find((o) => re.test(o.text || ""));
    if (hit) return hit;
  }
  options.find(
    (o) => /^(select|choose|please\s+select|--)/i.test(norm(o.text)) && o.value === ""
  );
  const otherish = options.find(
    (o) => /^(other|others?|different|not\s+listed)\b/i.test(norm(o.text))
  );
  return otherish ?? null;
}
const sleep$2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isBackground = () => document.visibilityState === "hidden";
function readableOptionText(el) {
  var _a, _b;
  let text = "";
  try {
    text = ((_a = el.innerText) == null ? void 0 : _a.trim()) || "";
  } catch {
  }
  if (!text) text = ((_b = el.textContent) == null ? void 0 : _b.trim()) || "";
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/(\w)([(\[])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return text;
}
async function applyHumanJitter(opts = {}) {
  if (isBackground()) return;
  if (opts.quick) {
    await sleep$2(2 + Math.floor(Math.random() * 10));
    return;
  }
  const jitter = Math.floor(Math.random() * 56 + 15);
  await sleep$2(jitter);
  if (Math.random() < 0.05) {
    window.scrollBy({ top: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 30 + 10), behavior: "auto" });
    await sleep$2(Math.floor(Math.random() * 40) + 20);
  }
}
function getNativeSelectOptions(select) {
  if (!select || select.tagName !== "SELECT") return [];
  return Array.from(select.options).filter((o) => !o.disabled && !(o.value === "" && /^(select|choose|please|--)/i.test((o.text || "").trim()))).map((o) => ({ value: o.value, text: (o.text || o.value || "").trim() })).filter((o) => o.text.length > 0);
}
async function fillTextInput(input, value, status = "success", opts = {}) {
  if (!input || value === void 0 || value === null) return false;
  const str = String(value);
  if (!str) return false;
  const instant = !!opts.instant || isBackground();
  await applyHumanJitter({ quick: instant });
  input.focus();
  input.scrollIntoView({ behavior: "auto", block: "center" });
  await sleep$2(instant ? 4 : 25);
  const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
  const setValue = (v) => {
    try {
      nativeSetter.call(input, v);
    } catch {
      input.value = v;
    }
  };
  if (instant) {
    setValue(str);
    try {
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: str }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {
      const errorMessage = (e == null ? void 0 : e.message) ?? String(e);
      if (errorMessage.includes("Extension context invalidated") || errorMessage.includes("Access to storage is not allowed from this context")) {
        return false;
      }
      console.warn("Aladdin fillTextInput instant events:", e);
    }
    await sleep$2(6);
    if (input.value !== str) {
      setValue(str);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    highlightField(input, status);
    return true;
  }
  setValue("");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  let currentVal = "";
  for (const char of str) {
    currentVal += char;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
    setValue(currentVal);
    input.dispatchEvent(new InputEvent("input", { data: char, inputType: "insertText", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }));
    if (!isBackground()) {
      await sleep$2(2 + Math.random() * 8);
    }
  }
  try {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  } catch (e) {
    const errorMessage = (e == null ? void 0 : e.message) ?? String(e);
    if (errorMessage.includes("Extension context invalidated") || errorMessage.includes("Access to storage is not allowed from this context")) {
      return false;
    }
    console.warn("Aladdin fillTextInput finalize:", e);
  }
  await sleep$2(15);
  if (input.value !== str) {
    setValue(str);
    try {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      console.warn("Verification event failed", e);
    }
  }
  highlightField(input, status);
  return true;
}
async function fillSelect(select, value, status = "success", precomputedOptions = null, { noFallback = false } = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  if (!select || value === void 0 || value === null) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  await applyHumanJitter({ quick: true });
  if (select.tagName === "SELECT") {
    const structured = (precomputedOptions == null ? void 0 : precomputedOptions.length) ? precomputedOptions : getNativeSelectOptions(select);
    let picked = matchHintToSelectOption(raw, structured);
    if (!picked && !noFallback) {
      const isLocationField2 = /\b(country|location|nation|state|province|region)\b/i.test(
        select.name || select.id || select.getAttribute("aria-label") || ""
      );
      if (!isLocationField2) {
        const fallback = pickFallbackSelectOption(structured);
        if (fallback) {
          picked = fallback;
          status = status === "success" ? "warning" : status;
        }
      }
    }
    if (picked) {
      select.value = picked.value;
      if (select.value !== picked.value && picked.text) {
        const byText = Array.from(select.options).find(
          (o) => o.text.trim() === picked.text.trim() || o.text.trim().includes(picked.text.trim())
        );
        if (byText) {
          select.selectedIndex = byText.index;
        }
      }
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.dispatchEvent(new Event("input", { bubbles: true }));
      highlightField(select, status);
      return true;
    }
  }
  const role = ((_a = select.getAttribute) == null ? void 0 : _a.call(select, "role")) || "";
  const isCombo = role === "combobox" || ((_b = select.getAttribute) == null ? void 0 : _b.call(select, "aria-haspopup")) === "listbox" || ((_c = select.getAttribute) == null ? void 0 : _c.call(select, "aria-haspopup")) === "true" || ((_d = select.getAttribute) == null ? void 0 : _d.call(select, "aria-expanded")) != null;
  if (isCombo) {
    try {
      (_e = select.focus) == null ? void 0 : _e.call(select);
      (_f = select.click) == null ? void 0 : _f.call(select);
    } catch {
    }
    try {
      (_g = select.dispatchEvent) == null ? void 0 : _g.call(select, new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      (_h = select.dispatchEvent) == null ? void 0 : _h.call(select, new KeyboardEvent("keyup", { key: "ArrowDown", bubbles: true }));
      (_i = select.dispatchEvent) == null ? void 0 : _i.call(select, new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      (_j = select.dispatchEvent) == null ? void 0 : _j.call(select, new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    } catch {
    }
  }
  const controlsId = ((_k = select.getAttribute) == null ? void 0 : _k.call(select, "aria-controls")) || ((_l = select.getAttribute) == null ? void 0 : _l.call(select, "aria-owns")) || "";
  const findListbox = () => {
    if (controlsId) {
      const byId = document.getElementById(controlsId) || document.querySelector(`[role="listbox"][id="${CSS.escape(controlsId)}"]`);
      if (byId) return byId;
    }
    const byRole = document.querySelector('[role="listbox"]');
    if (byRole) return byRole;
    const classPatterns = [
      '[class*="select__menu-list"]',
      '[class*="select__menu"]',
      '[class*="selectMenu"]',
      '[class*="Select-menu"]',
      '[class*="dropdown-menu"]:not([class*="nav"])',
      '[class*="options-list"]',
      '[class*="option-list"]',
      '[class*="combobox-dropdown"]',
      '[class*="listbox"]'
    ];
    for (const pattern of classPatterns) {
      try {
        const el = document.querySelector(pattern);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== "none" && s.visibility !== "hidden") return el;
        }
      } catch {
      }
    }
    return null;
  };
  const collectOptions = () => {
    const listbox = findListbox();
    if (!listbox) return [];
    const possibleOptions = listbox.querySelectorAll(
      '[role="option"], li[role="option"], li, [class*="option"], [class*="item"]'
    );
    return Array.from(possibleOptions).map((el) => {
      const text = readableOptionText(el);
      return { el, value: text, text };
    }).filter((o) => o.text);
  };
  await sleep$2(40);
  let structuredList = collectOptions();
  for (let i = 0; i < 8 && !structuredList.length; i++) {
    await sleep$2(80);
    structuredList = collectOptions();
  }
  if (structuredList.length) {
    const stripped = structuredList.map(({ value: value2, text }) => ({ value: value2, text }));
    let picked = matchHintToSelectOption(raw, stripped);
    if (!picked && !noFallback) {
      const isLocationField2 = /\b(country|location|nation|state|province|region)\b/i.test(
        select.name || select.id || ((_m = select.getAttribute) == null ? void 0 : _m.call(select, "aria-label")) || ""
      );
      if (!isLocationField2) {
        const fallback = pickFallbackSelectOption(stripped);
        if (fallback) {
          picked = fallback;
          status = status === "success" ? "warning" : status;
        }
      }
    }
    if (picked) {
      const row = structuredList.find((o) => o.text === picked.text);
      if (row == null ? void 0 : row.el) {
        row.el.click();
        try {
          (_n = select.dispatchEvent) == null ? void 0 : _n.call(select, new Event("input", { bubbles: true }));
          (_o = select.dispatchEvent) == null ? void 0 : _o.call(select, new Event("change", { bubbles: true }));
          (_p = select.dispatchEvent) == null ? void 0 : _p.call(select, new Event("blur", { bubbles: true }));
        } catch {
        }
        highlightField(select, status);
        return true;
      }
    }
  }
  return false;
}
function getRadioGroupLabel(radioEl) {
  var _a;
  const fieldset = radioEl.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend) return legend.textContent.trim();
  }
  const group = radioEl.closest('[role="group"]');
  if (group) {
    const id = group.getAttribute("aria-labelledby");
    if (id) {
      const el2 = document.getElementById(id);
      if (el2) return el2.textContent.trim();
    }
    const ariaLabel = group.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();
  }
  let el = radioEl.parentElement;
  for (let depth = 0; depth < 10 && el; depth++) {
    let prev = el.previousElementSibling;
    while (prev) {
      if (!prev.querySelector('input[type="radio"], input[type="checkbox"]')) {
        const text = ((_a = prev.textContent) == null ? void 0 : _a.trim()) ?? "";
        if (text.length > 4 && text.length < 300) return text;
      }
      prev = prev.previousElementSibling;
    }
    el = el.parentElement;
  }
  return "";
}
function getRadioGroupOptions(radioEl) {
  const type = radioEl.type;
  const name = radioEl.name;
  let inputs;
  if (name) {
    inputs = Array.from(
      document.querySelectorAll(`input[type="${type}"][name="${CSS.escape(name)}"]`)
    );
  } else {
    const container = radioEl.closest('fieldset, [role="group"], .field, .form-group, li, div') ?? radioEl.parentElement;
    inputs = container ? Array.from(container.querySelectorAll(`input[type="${type}"]`)) : [radioEl];
  }
  return inputs.map((el) => ({ element: el, text: getLabelForInput(el) || el.value || "" })).filter((o) => o.text.trim().length > 0);
}
async function fillRadioGroupOption(options, answerText, status = "success") {
  if (!(options == null ? void 0 : options.length) || !answerText) return false;
  await applyHumanJitter({ quick: true });
  const candidates = extractHintCandidates(answerText).map((c) => c.toLowerCase().trim());
  const norm2 = (s) => s.toLowerCase().replace(/[.,;:!?'"]/g, "").trim();
  for (const { element, text } of options) {
    const optNorm = norm2(text);
    if (candidates.some((c) => c === optNorm)) {
      return _clickRadioOption(element, status);
    }
  }
  for (const { element, text } of options) {
    const optNorm = norm2(text);
    if (candidates.some((c) => optNorm.includes(c) || c.includes(optNorm))) {
      return _clickRadioOption(element, status);
    }
  }
  let bestScore = 0;
  let bestEl = null;
  for (const { element, text } of options) {
    const optWords = norm2(text).split(/\W+/).filter((w) => w.length > 1);
    for (const c of candidates) {
      const candWords = new Set(c.split(/\W+/).filter((w) => w.length > 1));
      const overlap = optWords.filter((w) => candWords.has(w)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestEl = element;
      }
    }
  }
  if (bestEl && bestScore > 0) {
    return _clickRadioOption(bestEl, status);
  }
  return false;
}
function _clickRadioOption(input, status = "success") {
  if (!input) return false;
  try {
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!input.checked) {
      input.click();
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    highlightField(input, status);
    return true;
  } catch {
    return false;
  }
}
function fillFileInput(fileInput, base64Pdf, filename = "resume.pdf") {
  try {
    if (!fileInput || fileInput.tagName !== "INPUT" || fileInput.type !== "file") return false;
    const bytes = Uint8Array.from(atob(base64Pdf), (c) => c.charCodeAt(0));
    const file = new File([bytes], filename, { type: "application/pdf" });
    const dt = new DataTransfer();
    dt.items.add(file);
    try {
      fileInput.value = "";
    } catch {
    }
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    highlightField(fileInput, true);
    return true;
  } catch (e) {
    console.error("File injection failed", e);
    return false;
  }
}
async function sniffComboboxOptions(element) {
  var _a, _b, _c, _d;
  if (!element) return [];
  try {
    (_a = element.focus) == null ? void 0 : _a.call(element);
  } catch {
  }
  try {
    (_b = element.click) == null ? void 0 : _b.call(element);
  } catch {
  }
  const findListbox = () => {
    var _a2, _b2;
    const controlsId = ((_a2 = element.getAttribute) == null ? void 0 : _a2.call(element, "aria-controls")) || ((_b2 = element.getAttribute) == null ? void 0 : _b2.call(element, "aria-owns")) || "";
    if (controlsId) {
      const byId = document.getElementById(controlsId);
      if (byId) return byId;
    }
    const byRole = document.querySelector('[role="listbox"]');
    if (byRole) return byRole;
    const classPatterns = [
      '[class*="select__menu-list"]',
      '[class*="select__menu"]',
      '[class*="selectMenu"]',
      '[class*="Select-menu"]',
      '[class*="dropdown-menu"]:not([class*="nav"])',
      '[class*="options-list"]',
      '[class*="option-list"]',
      '[class*="combobox-dropdown"]',
      '[class*="listbox"]'
    ];
    for (const pattern of classPatterns) {
      try {
        const el = document.querySelector(pattern);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== "none" && s.visibility !== "hidden") return el;
        }
      } catch {
      }
    }
    return null;
  };
  const collectOpts = () => {
    const listbox = findListbox();
    if (!listbox) return [];
    return Array.from(
      listbox.querySelectorAll('[role="option"], li[role="option"], li, [class*="option"], [class*="item"]')
    ).map((el) => {
      const text = readableOptionText(el);
      return { value: text, text };
    }).filter((o, i, arr) => o.text.length > 0 && arr.findIndex((x) => x.text === o.text) === i);
  };
  const bg = isBackground();
  await sleep$2(bg ? 0 : 100);
  let opts = collectOpts();
  const maxRetries = bg ? 2 : 6;
  const retryDelay = bg ? 0 : 120;
  for (let i = 0; i < maxRetries && !opts.length; i++) {
    await sleep$2(retryDelay);
    opts = collectOpts();
  }
  try {
    (_c = element.dispatchEvent) == null ? void 0 : _c.call(element, new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    (_d = element.dispatchEvent) == null ? void 0 : _d.call(element, new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
  } catch {
  }
  return opts;
}
async function clickAutocompleteSuggestion(input, typedValue) {
  var _a, _b, _c;
  const hint = String(typedValue || "").trim();
  if (!hint) return false;
  try {
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      data: hint.slice(-1),
      inputType: "insertText"
    }));
  } catch {
  }
  await sleep$2(isBackground() ? 0 : 350);
  const findSuggestions = () => {
    var _a2, _b2;
    const controlsId = ((_a2 = input.getAttribute) == null ? void 0 : _a2.call(input, "aria-controls")) || ((_b2 = input.getAttribute) == null ? void 0 : _b2.call(input, "aria-owns")) || "";
    if (controlsId) {
      const listbox = document.getElementById(controlsId);
      if (listbox) {
        const opts = listbox.querySelectorAll('[role="option"], li');
        if (opts.length) return Array.from(opts);
      }
    }
    const parent = input.closest('.field, .form-group, [data-automation-id="formField"], div') || input.parentElement;
    if (parent) {
      const listbox = parent.querySelector('[role="listbox"]');
      if (listbox) {
        const opts = listbox.querySelectorAll('[role="option"], li');
        if (opts.length) return Array.from(opts);
      }
    }
    const globalListbox = document.querySelector('[role="listbox"]');
    if (globalListbox) {
      const opts = globalListbox.querySelectorAll('[role="option"], li');
      if (opts.length) return Array.from(opts);
    }
    const candidates = document.querySelectorAll(
      '[role="option"], .pac-item, [class*="suggestion"], [class*="autocomplete"] li, [class*="dropdown"] li'
    );
    if (candidates.length) return Array.from(candidates);
    return [];
  };
  let suggestions = findSuggestions();
  const _bgMode = isBackground();
  const _maxSuggRetries = _bgMode ? 1 : 4;
  const _suggRetryDelay = _bgMode ? 0 : 200;
  for (let i = 0; i < _maxSuggRetries && !suggestions.length; i++) {
    await sleep$2(_suggRetryDelay);
    suggestions = findSuggestions();
  }
  if (!suggestions.length) return false;
  const hintLower = hint.toLowerCase();
  let bestEl = null;
  let bestScore = 0;
  for (const el of suggestions) {
    const text = (el.textContent || "").trim().toLowerCase();
    if (!text) continue;
    let score = 0;
    if (text === hintLower) score = 1e3;
    else if (text.includes(hintLower)) score = 800 + Math.min(hintLower.length, 80);
    else if (hintLower.includes(text)) score = 700 + Math.min(text.length, 80);
    else {
      const hTokens = new Set(hintLower.split(/\s+/).filter((w) => w.length > 1));
      const oTokens = new Set(text.split(/\s+/).filter((w) => w.length > 1));
      let inter = 0;
      for (const t of hTokens) if (oTokens.has(t)) inter++;
      const union = hTokens.size + oTokens.size - inter;
      score = union ? inter / union * 380 : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }
  if (suggestions.length > 0) {
    const topEl = suggestions[0];
    const topText = (topEl.textContent || "").trim().toLowerCase();
    const hintWords = hint.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const topContainsHint = topText.includes(hint.toLowerCase()) || hintWords.length > 0 && hintWords.every((w) => topText.includes(w));
    if (bestEl && bestScore >= 150) {
      bestEl.click();
      await sleep$2(50);
    } else if (topContainsHint) {
      topEl.click();
      await sleep$2(50);
    }
    try {
      (_a = input.dispatchEvent) == null ? void 0 : _a.call(input, new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, code: "Enter", bubbles: true }));
      (_b = input.dispatchEvent) == null ? void 0 : _b.call(input, new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, code: "Enter", bubbles: true }));
    } catch {
    }
    try {
      (_c = input.dispatchEvent) == null ? void 0 : _c.call(input, new Event("change", { bubbles: true }));
    } catch {
    }
    return true;
  }
  return false;
}
async function fillLocationWithAutocomplete(input, value) {
  var _a, _b;
  const str = String(value || "").trim();
  if (!str) return false;
  if (isBackground()) {
    return fillTextInput(input, str, "success", { instant: true });
  }
  input.focus();
  input.scrollIntoView({ behavior: "auto", block: "center" });
  await sleep$2(80);
  const proto = HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
  const setValue = (v) => {
    try {
      nativeSetter.call(input, v);
    } catch {
      input.value = v;
    }
  };
  setValue("");
  try {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } catch {
  }
  const typeCharByChar = async (upToIndex) => {
    var _a2;
    const currentVal = str.slice(0, upToIndex);
    const startFrom = ((_a2 = input.value) == null ? void 0 : _a2.length) ?? 0;
    for (let i = startFrom; i < upToIndex; i++) {
      const char = str[i];
      const partial = str.slice(0, i + 1);
      try {
        input.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
        setValue(partial);
        input.dispatchEvent(new InputEvent("input", { data: char, inputType: "insertText", bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }));
      } catch {
      }
      if (!isBackground()) await sleep$2(40 + Math.random() * 30);
    }
    return currentVal;
  };
  const gatherSuggestions = () => {
    var _a2, _b2;
    const controlsId = ((_a2 = input.getAttribute) == null ? void 0 : _a2.call(input, "aria-controls")) || ((_b2 = input.getAttribute) == null ? void 0 : _b2.call(input, "aria-owns")) || "";
    if (controlsId) {
      const lb = document.getElementById(controlsId);
      if (lb) {
        const opts = lb.querySelectorAll('[role="option"], li');
        if (opts.length) return Array.from(opts);
      }
    }
    const parent = input.closest('.field, .form-group, [data-automation-id="formField"], div') || input.parentElement;
    if (parent) {
      const lb = parent.querySelector('[role="listbox"]');
      if (lb) {
        const opts = lb.querySelectorAll('[role="option"], li');
        if (opts.length) return Array.from(opts);
      }
    }
    const globalLb = document.querySelector('[role="listbox"]');
    if (globalLb) {
      const opts = globalLb.querySelectorAll('[role="option"], li');
      if (opts.length) return Array.from(opts);
    }
    const cands = document.querySelectorAll('[role="option"], .pac-item, [class*="suggestion"], [class*="autocomplete"] li, [class*="dropdown"] li');
    return Array.from(cands);
  };
  const scoreSugg = (text) => {
    const t = text.toLowerCase();
    const h = str.toLowerCase();
    if (t === h) return 1e3;
    if (t.includes(h)) return 800 + Math.min(h.length, 80);
    if (h.includes(t)) return 700 + Math.min(t.length, 80);
    const hTok = new Set(h.split(/\W+/).filter((w) => w.length > 1));
    const tTok = new Set(t.split(/\W+/).filter((w) => w.length > 1));
    let inter = 0;
    for (const w of hTok) if (tTok.has(w)) inter++;
    const union = hTok.size + tTok.size - inter;
    return union ? inter / union * 380 : 0;
  };
  const tryClickBest = async () => {
    let suggs = gatherSuggestions();
    for (let i = 0; i < 3 && !suggs.length; i++) {
      await sleep$2(80);
      suggs = gatherSuggestions();
    }
    if (!suggs.length) return false;
    let bestEl = null, bestScore = 0;
    for (const el of suggs) {
      const score = scoreSugg((el.textContent || "").trim());
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }
    if (bestEl && bestScore >= 150) {
      try {
        bestEl.click();
        await sleep$2(80);
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, code: "Enter", bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, code: "Enter", bubbles: true }));
        await sleep$2(50);
        highlightField(input, "success");
        return true;
      } catch {
      }
    }
    return false;
  };
  const wordBreakpoints = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] === " " || str[i] === "," || i === str.length - 1) {
      wordBreakpoints.push(i + 1);
    }
  }
  const breakpoints = [...new Set(wordBreakpoints)];
  if (!breakpoints.includes(str.length)) breakpoints.push(str.length);
  for (const bp of breakpoints) {
    await typeCharByChar(bp);
    await sleep$2(200 + Math.random() * 100);
    if (await tryClickBest()) return true;
  }
  if ((((_a = input.value) == null ? void 0 : _a.length) ?? 0) < str.length) {
    await typeCharByChar(str.length);
  }
  await sleep$2(250);
  if (await tryClickBest()) return true;
  if ((_b = input.value) == null ? void 0 : _b.trim()) {
    highlightField(input, "success");
    return true;
  }
  return false;
}
function highlightField(el, status = "success") {
  const original = el.style.outline;
  let color = "#10b981";
  if (status === "warning") color = "#eab308";
  if (status === "error" || status === false) color = "#ef4444";
  el.style.outline = `2px solid ${color}`;
  el.style.transition = "outline 0.3s ease";
  setTimeout(() => {
    el.style.outline = original;
  }, 1500);
}
function isConditionalFollowUp(el, fieldLabel) {
  var _a;
  const combined = `${fieldLabel} ${(el == null ? void 0 : el.placeholder) || ""} ${((_a = el == null ? void 0 : el.getAttribute) == null ? void 0 : _a.call(el, "aria-label")) || ""}`.toLowerCase();
  if (/\b(specify|please explain|please describe|if other|additional detail|please enter)\b/.test(combined) && /\b(hear|heard|referral|source|opening|opportunity|position|job|find us|about us)\b/.test(combined)) {
    return false;
  }
  const container = el.closest('fieldset, [role="group"]') ?? el.closest('.field, .form-group, li, [class*="question"], [class*="pronoun"], [class*="eeo"]');
  if (!container) return false;
  const checkboxes = Array.from(
    container.querySelectorAll('input[type="radio"], input[type="checkbox"]')
  );
  if (!checkboxes.length) return false;
  const lowerLabel = fieldLabel.toLowerCase().trim();
  if (lowerLabel) {
    for (const cb of checkboxes) {
      const cbLabel = (getLabelForInput(cb) || cb.value || "").toLowerCase().trim();
      if (cbLabel && (lowerLabel.includes(cbLabel) || cbLabel.includes(lowerLabel))) {
        return !cb.checked;
      }
    }
  }
  if (/\b(custom|other|specify|please|describe|if yes|if so|pronoun)\b/i.test(fieldLabel)) {
    const anyChecked = checkboxes.some((cb) => cb.checked);
    if (!anyChecked) return true;
    return !checkboxes.some(
      (cb) => cb.checked && /\b(custom|other)\b/i.test(getLabelForInput(cb) || cb.value || "")
    );
  }
  return false;
}
function getLabelForInput(input) {
  var _a, _b, _c;
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return (_a = label.textContent) == null ? void 0 : _a.trim();
  }
  const parent = input.closest("label");
  if (parent) return (_b = parent.textContent) == null ? void 0 : _b.replace(input.value, "").trim();
  const container = input.closest('.field, [data-automation-id="formField"]');
  if (container) {
    const label = container.querySelector("label");
    if (label) return (_c = label.textContent) == null ? void 0 : _c.trim();
  }
  return null;
}
const sleep$1 = (ms) => new Promise((r) => setTimeout(r, ms));
let _booted = false;
function bootHeadlessFrame() {
  if (_booted) return;
  _booted = true;
  _postToParent({ action: "FRAME_READY", href: window.location.href });
  window.addEventListener("message", async (event) => {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || msg.source !== "aladdin-parent") return;
    if (msg.action === "FILL_FRAME") {
      const { profile: profile2, jobTitle: jobTitle2 = "", company: company2 = "", requestId = null } = msg;
      const result = await _fillFrame(profile2);
      _postToParent({ action: "FILL_RESULT", requestId, ...result });
    }
  });
}
function detectFramePlatform() {
  const host2 = String(window.location.hostname || "").toLowerCase();
  if (host2.includes("icims.com")) return "icims";
  if (host2.includes("taleo")) return "taleo";
  if (host2.includes("greenhouse.io")) return "greenhouse";
  if (host2.includes("lever.co")) return "lever";
  if (host2.includes("workable.com")) return "workable";
  if (host2.includes("ashbyhq.com")) return "ashby";
  if (host2.includes("myworkdayjobs.com")) return "workday";
  if (host2.includes("smartrecruiters.com")) return "smartrecruiters";
  if (host2.includes("jobvite.com")) return "jobvite";
  if (host2.includes("recruiting.ultipro.com")) return "ultipro";
  return "generic";
}
function _postToParent(payload) {
  try {
    window.parent.postMessage({ source: "aladdin-frame", ...payload }, "*");
  } catch {
  }
}
async function _fillFrame(profile2, jobTitle2, company2) {
  var _a;
  if (!isContextValid()) return { filled: 0, skipped: 0, failed: 0 };
  const platform2 = detectFramePlatform();
  const fields = scanFields(platform2, () => {
  });
  let filled = 0;
  let skipped = 0;
  let failed = 0;
  const processedRadioGroups2 = /* @__PURE__ */ new Set();
  for (const field of fields) {
    if (!isContextValid()) break;
    const { element, type, label, placeholder, name, ariaLabel, selectOptions = [] } = field;
    if (!(element == null ? void 0 : element.isConnected)) continue;
    if (type === "file") {
      skipped++;
      continue;
    }
    if (type === "radio" || type === "checkbox") {
      const groupKey = element.name || ((_a = element.closest('fieldset, [role="group"]')) == null ? void 0 : _a.id) || null;
      if (groupKey && processedRadioGroups2.has(groupKey)) {
        skipped++;
        continue;
      }
      if (groupKey) processedRadioGroups2.add(groupKey);
      const groupLabel = getRadioGroupLabel(element) || label;
      const groupOptions = getRadioGroupOptions(element);
      const profileVal = matchFieldToProfile({ label: groupLabel, placeholder: "", name: element.name || "", ariaLabel: "" }, profile2) ?? fuzzyMatchFieldToProfile({ label: groupLabel, placeholder: "", name: element.name || "", ariaLabel: "" }, profile2);
      if (profileVal) {
        const ok = await fillRadioGroupOption(groupOptions, String(profileVal));
        ok ? filled++ : failed++;
      } else {
        skipped++;
      }
      continue;
    }
    const profileValue = matchFieldToProfile({ label, placeholder, name, ariaLabel }, profile2) ?? fuzzyMatchFieldToProfile({ label, placeholder, name, ariaLabel }, profile2);
    if (profileValue !== null) {
      let ok = false;
      if (type === "select") {
        let opts = (selectOptions == null ? void 0 : selectOptions.length) ? selectOptions : getNativeSelectOptions(element);
        if (!opts.length) opts = await sniffComboboxOptions(element);
        ok = await fillSelect(element, profileValue, "success", opts.length ? opts : null);
      } else {
        ok = await fillTextInput(element, profileValue, "success", { instant: true });
      }
      ok ? filled++ : failed++;
      await sleep$1(30);
    } else {
      skipped++;
    }
  }
  return { filled, skipped, failed };
}
const FILL_TIMEOUT_MS = 3e4;
const DEFAULT_POLL_MS = 150;
let _installed = false;
const readyFrames = /* @__PURE__ */ new Map();
const inflight = /* @__PURE__ */ new Map();
let _nextRequestId = 1;
function initIframeCoordinator() {
  if (_installed) return;
  if (typeof window === "undefined") return;
  _installed = true;
  window.addEventListener("message", _onMessage);
}
function _onMessage(event) {
  const msg = event == null ? void 0 : event.data;
  if (!msg || msg.source !== "aladdin-frame") return;
  if (msg.action === "FRAME_READY") {
    if (event.source) readyFrames.set(event.source, { href: msg.href || "" });
    return;
  }
  if (msg.action === "FILL_RESULT") {
    const ticket = inflight.get(msg.requestId);
    if (!ticket) return;
    ticket.partial.push({
      filled: Number(msg.filled) || 0,
      skipped: Number(msg.skipped) || 0,
      failed: Number(msg.failed) || 0,
      frame: event.source
    });
    ticket.frames.delete(event.source);
    if (ticket.frames.size === 0) {
      clearTimeout(ticket.timer);
      inflight.delete(msg.requestId);
      ticket.resolve(ticket.partial);
    }
  }
}
function collectAtsIframes(root = typeof document === "undefined" ? null : document) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  const matches2 = [];
  const iframes = root.querySelectorAll("iframe");
  for (const el of iframes) {
    const src = el.getAttribute("src") || el.src || "";
    if (!src) continue;
    let host2 = "";
    try {
      host2 = new URL(src, location.href).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (_matchesAtsHost(host2)) matches2.push(el);
  }
  return matches2;
}
function _matchesAtsHost(host2) {
  if (!host2) return false;
  return ATS_IFRAME_HOSTS.some((x) => host2 === x || host2.endsWith("." + x) || host2.includes(x));
}
async function fillAllAtsIframes({
  profile: profile2,
  jobTitle: jobTitle2 = "",
  company: company2 = "",
  panel: panel2 = null,
  timeoutMs = FILL_TIMEOUT_MS,
  win = typeof window !== "undefined" ? window : null
} = {}) {
  var _a;
  const zero = { filled: 0, skipped: 0, failed: 0, dispatched: 0, replied: 0 };
  if (!profile2 || !win) return zero;
  const iframes = collectAtsIframes(win.document);
  if (iframes.length === 0) return zero;
  const targets = [];
  for (const el of iframes) {
    try {
      const cw = el.contentWindow;
      if (cw) targets.push({ el, cw });
    } catch {
    }
  }
  if (targets.length === 0) return zero;
  await _waitForFramesReady(targets.map((t) => t.cw), 1500);
  const requestId = `aladdin-fill-${Date.now()}-${_nextRequestId++}`;
  const frameSet = new Set(targets.map((t) => t.cw));
  (_a = panel2 == null ? void 0 : panel2.addLog) == null ? void 0 : _a.call(
    panel2,
    `Form lives inside ${targets.length} embedded iframe${targets.length > 1 ? "s" : ""}. Filling there.`
  );
  const resultPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      inflight.delete(requestId);
      resolve(_ticketOrEmpty());
    }, timeoutMs);
    inflight.set(requestId, {
      resolve: (partial) => resolve(partial),
      frames: frameSet,
      partial: [],
      timer
    });
  });
  for (const { cw } of targets) {
    try {
      cw.postMessage({
        source: "aladdin-parent",
        action: "FILL_FRAME",
        requestId,
        profile: profile2,
        jobTitle: jobTitle2,
        company: company2
      }, "*");
    } catch {
    }
  }
  const results = await resultPromise;
  const agg = results.reduce((acc, r) => ({
    filled: acc.filled + (r.filled || 0),
    skipped: acc.skipped + (r.skipped || 0),
    failed: acc.failed + (r.failed || 0)
  }), { filled: 0, skipped: 0, failed: 0 });
  const summary = {
    ...agg,
    dispatched: targets.length,
    replied: results.length
  };
  if (panel2 == null ? void 0 : panel2.addLog) {
    if (summary.replied === 0) {
      panel2.addLog("Embedded application did not respond. Try refreshing the page.");
    } else {
      panel2.addLog(
        `Embedded form: filled ${summary.filled}, skipped ${summary.skipped}` + (summary.failed ? `, failed ${summary.failed}` : "") + "."
      );
    }
  }
  return summary;
}
function _ticketOrEmpty() {
  return [];
}
async function _waitForFramesReady(expected, maxMs) {
  const start = Date.now();
  const allReady = () => expected.every((w) => readyFrames.has(w));
  if (allReady()) return;
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, DEFAULT_POLL_MS));
    if (allReady()) return;
  }
}
function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const s = window.getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) return true;
  const tag = el.tagName;
  const txt = (el.textContent || el.value || "").trim();
  if (txt && (tag === "BUTTON" || el.getAttribute("role") === "button")) return true;
  return false;
}
function textOf(el) {
  return (el.textContent || el.value || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
}
function findWorkdaySaveAndContinue(root = document) {
  const selectors = [
    '[data-automation-id="bottom-navigation-next-button"]',
    '[data-automation-id="nextButton"]',
    '[data-automation-id="footerButtons"] button',
    '[data-automation-id="footerButtons"] [role="button"]',
    '[data-automation-id="footerButtons"] div[tabindex="0"]',
    '[data-automation-id="pageFooter"] button',
    '[data-automation-id="pageFooter"] [role="button"]',
    '[data-automation-id="pageFooter"] div[tabindex="0"]',
    '[data-automation-id="footerContainer"] [role="button"]',
    '[data-automation-id="footerContainer"] button'
  ];
  const rank = (txt) => {
    if (txt.includes("save and continue")) return 0;
    if (txt === "continue" || txt.startsWith("continue ")) return 1;
    if (txt.includes("next step")) return 2;
    if (txt === "next" || txt.startsWith("next ")) return 3;
    return 99;
  };
  let best = null;
  let bestRank = Infinity;
  for (const sel of selectors) {
    let nodes;
    try {
      nodes = root.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const txt = textOf(el);
      const r = rank(txt);
      if (r === 99) continue;
      if (r < bestRank) {
        bestRank = r;
        best = el;
      }
    }
  }
  if (best) return best;
  const footer = root.querySelector(
    '[data-automation-id="pageFooter"], [data-automation-id="footerContainer"], [data-automation-id="footerButtons"]'
  );
  if (!footer) return null;
  const candidates = footer.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a[role="button"], div[tabindex="0"]');
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const txt = textOf(el);
    const r = rank(txt);
    if (r === 99) continue;
    if (r < bestRank) {
      bestRank = r;
      best = el;
    }
  }
  return best;
}
const BANNER_ID = "aladdin-bg-warning-banner";
const DISMISSED_KEY = "aladdin-bg-warning-dismissed";
function showBackgroundWarningBanner(platformLabel = "This page") {
  if (sessionStorage.getItem(DISMISSED_KEY) === "1") return;
  if (document.getElementById(BANNER_ID)) return;
  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483646",
    background: "#FEF3C7",
    color: "#92400E",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "13px",
    fontWeight: "500",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    borderBottom: "2px solid #F59E0B",
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
    lineHeight: "1.5",
    boxSizing: "border-box"
  });
  const message = document.createElement("span");
  message.textContent = `⚠️  ${platformLabel} requires your attention to fill some fields correctly. AutoApply may miss certain questions if you switch away from this tab — please stay here while it runs.`;
  const dismiss = document.createElement("button");
  dismiss.textContent = "Got it";
  Object.assign(dismiss.style, {
    background: "#F59E0B",
    color: "#ffffff",
    border: "none",
    borderRadius: "5px",
    padding: "5px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: "0",
    lineHeight: "1.4"
  });
  dismiss.addEventListener("click", () => {
    banner.remove();
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
    }
  });
  banner.appendChild(message);
  banner.appendChild(dismiss);
  (document.body ?? document.documentElement).appendChild(banner);
}
function hideBackgroundWarningBanner() {
  var _a;
  (_a = document.getElementById(BANNER_ID)) == null ? void 0 : _a.remove();
}
function resetBackgroundWarningDismissal() {
  try {
    sessionStorage.removeItem(DISMISSED_KEY);
  } catch {
  }
}
let isPaused = false;
let isStopped = false;
let isRunning = false;
let answerCache = {};
let fieldsToFill = [];
let currentIndex = 0;
let completedElements = /* @__PURE__ */ new Set();
let progressBreakdown = { profileAnswered: 0, aiAnswered: 0, manualAnswered: 0 };
let pendingFileUploads = [];
let failedFields = [];
let processedRadioGroups = /* @__PURE__ */ new Set();
let _inVerificationPass = false;
const BACKGROUND_UNRELIABLE_PLATFORMS = ["workday"];
const PLATFORM_LABELS = { workday: "Workday" };
let _lockRelease = null;
let _visibilityHandler = null;
let _autoAdvanceEnabled = false;
let _panel = null;
let _profile = null;
let _jobTitle = "";
let _company = "";
let _platform = null;
let _ensureProfile = null;
let _syncPanelProfileData = null;
const DOCUMENT_PATTERNS = {
  resume: /\b(resume|cv|curriculum vitae)\b/i,
  coverLetter: /\b(cover letter|motivation letter|motivational letter|letter of motivation)\b/i
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function notifyIfBackground(title, message) {
  if (document.visibilityState !== "hidden") return;
  const tabResponse = await safeSendMessage({ action: "GET_TAB_ID" });
  const tabId = (tabResponse == null ? void 0 : tabResponse.tabId) ?? null;
  await safeSendMessage({ action: "NOTIFY_USER", title, message, tabId });
}
function init({ panel: panel2, profile: profile2, jobTitle: jobTitle2, company: company2, platform: platform2, ensureProfile: ensureProfile2, saveLearnedAnswer: saveLearnedAnswer2, syncPanelProfileData: syncPanelProfileData2 }) {
  _panel = panel2;
  _profile = profile2;
  _jobTitle = jobTitle2;
  _company = company2;
  _platform = platform2;
  _ensureProfile = ensureProfile2;
  _syncPanelProfileData = syncPanelProfileData2;
}
function setPanel(panel2) {
  _panel = panel2;
}
function setProfile(profile2) {
  _profile = profile2;
}
function setJobMeta(jobTitle2, company2) {
  _jobTitle = jobTitle2;
  _company = company2;
}
function setAutoAdvanceEnabled(enabled) {
  _autoAdvanceEnabled = !!enabled;
}
function pause() {
  isPaused = true;
}
function stop() {
  isStopped = true;
  stopObserver();
  _cleanupBackgroundSession();
}
function _cleanupBackgroundSession() {
  _lockRelease == null ? void 0 : _lockRelease();
  _lockRelease = null;
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
    _visibilityHandler = null;
  }
  hideBackgroundWarningBanner();
}
function isMandatoryField(el, labelText = "") {
  if (el.required || el.getAttribute("aria-required") === "true") return true;
  if (/\*/.test(labelText) || /\(required\)/i.test(labelText)) return true;
  if (el.closest('[data-automation-id="formField--required"]')) return true;
  if (el.closest('.required, [class*="required"], [class*="mandatory"]')) return true;
  return false;
}
const NEXT_BUTTON_MAP = {
  workday: [
    '[data-automation-id="nextButton"]',
    '[data-automation-id="bottom-navigation-next-button"]',
    'button[data-automation-id*="next"]'
  ],
  icims: [
    'button[id*="next" i]',
    'input[value="Next"]',
    ".icims-button-next",
    'a[class*="btn-next"]'
  ],
  taleo: [
    "#btn_next",
    'a[id*="next" i]',
    'input[name*="next" i]',
    'button[id*="Next"]'
  ],
  lever: [],
  // single-page form — no advance needed
  greenhouse: []
  // single-page form — no advance needed
};
const NEXT_TEXT_PATTERNS = [
  "save and continue",
  "next step",
  "continue",
  "next",
  "proceed",
  "go to next"
];
function _isVisibleBtn(el) {
  const s = window.getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function findNextButton(platform2) {
  if (platform2 === "workday") {
    const wd = findWorkdaySaveAndContinue();
    if (wd) return wd;
  }
  const selectors = NEXT_BUTTON_MAP[platform2] ?? [];
  for (const sel of selectors) {
    try {
      const btn = document.querySelector(sel);
      if (btn && _isVisibleBtn(btn)) return btn;
    } catch {
    }
  }
  const candidates = Array.from(document.querySelectorAll(
    'button:not([disabled]), input[type="button"]:not([disabled]), input[type="submit"]:not([disabled]), a[role="button"], [role="button"]:not([disabled])'
  ));
  let bestBtn = null;
  let bestRank = Infinity;
  for (const btn of candidates) {
    if (!_isVisibleBtn(btn)) continue;
    const text = (btn.textContent || btn.value || btn.getAttribute("aria-label") || "").toLowerCase().trim();
    const rank = NEXT_TEXT_PATTERNS.findIndex((p) => text.includes(p));
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
      bestBtn = btn;
    }
  }
  return bestBtn;
}
async function _tryAutoAdvance() {
  const unfilled = fieldsToFill.filter((f) => {
    var _a;
    if (!((_a = f.element) == null ? void 0 : _a.isConnected)) return false;
    if (isFieldAnswered(f)) return false;
    if (f.type === "file") return false;
    return true;
  });
  const mandatoryUnfilled = unfilled.filter((f) => {
    const mandatory = isMandatoryField(f.element, f.label);
    return mandatory || !f.element.getAttribute("aria-required");
  });
  if (mandatoryUnfilled.length > 0) {
    _panel == null ? void 0 : _panel.addLog(
      `Auto-advance blocked — ${mandatoryUnfilled.length} required field(s) still need attention.`
    );
    for (const f of mandatoryUnfilled) {
      try {
        const orig = f.element.style.outline;
        f.element.style.outline = "2px solid #ef4444";
        setTimeout(() => {
          try {
            f.element.style.outline = orig;
          } catch {
          }
        }, 4e3);
      } catch {
      }
    }
    return;
  }
  const nextBtn = findNextButton(_platform);
  if (!nextBtn) {
    _panel == null ? void 0 : _panel.addLog("Auto-advance: could not locate a Next/Continue button on this step.");
    return;
  }
  _panel == null ? void 0 : _panel.addLog("Auto-advancing to the next step…");
  await sleep(500 + Math.random() * 300);
  try {
    nextBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(200);
    nextBtn.click();
    nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  } catch (e) {
    _panel == null ? void 0 : _panel.addLog("Auto-advance click failed — please click Next manually.");
  }
}
function normalizeText$1(value) {
  return typeof value === "string" ? value : "";
}
function isFieldAnswered(field) {
  var _a;
  const { element, type } = field;
  if (!element || !element.isConnected) return false;
  if (type === "checkbox" || type === "radio") return !!element.checked;
  if (type === "file") return (((_a = element.files) == null ? void 0 : _a.length) ?? 0) > 0;
  return typeof element.value === "string" ? element.value.trim().length > 0 : !!element.value;
}
function getFieldLabel(field) {
  return field.label || field.placeholder || field.name || "This field";
}
function isLocationField(field) {
  const text = [field.label, field.placeholder, field.name, field.ariaLabel].filter(Boolean).join(" ").toLowerCase();
  return /\b(location|city|address|zip|postal|state|region|where are you|current location)\b/.test(text);
}
function getFieldText(field) {
  return [field.label, field.placeholder, field.name, field.ariaLabel, field.context].filter(Boolean).join(" ").toLowerCase();
}
function detectRequestedDocument(field) {
  const fieldText = getFieldText(field);
  if (DOCUMENT_PATTERNS.resume.test(fieldText)) return "resume";
  if (DOCUMENT_PATTERNS.coverLetter.test(fieldText)) return "coverLetter";
  return null;
}
function getStoredDocument(documentType) {
  var _a, _b;
  if (documentType === "resume" && ((_a = _profile == null ? void 0 : _profile.resume) == null ? void 0 : _a.ready)) {
    return { label: "resume", filename: normalizeText$1(_profile.resume.filename) || "resume.pdf" };
  }
  if (documentType === "coverLetter" && ((_b = _profile == null ? void 0 : _profile.coverLetter) == null ? void 0 : _b.ready)) {
    return { label: "cover letter", filename: normalizeText$1(_profile.coverLetter.filename) || "cover-letter.pdf" };
  }
  return null;
}
function updateProgress() {
  _panel == null ? void 0 : _panel.setProgress({
    totalQuestions: fieldsToFill.length,
    answeredQuestions: completedElements.size,
    profileAnswered: progressBreakdown.profileAnswered,
    aiAnswered: progressBreakdown.aiAnswered,
    manualAnswered: progressBreakdown.manualAnswered,
    pendingQuestions: Math.max(fieldsToFill.length - completedElements.size, 0)
  });
}
function markAnswered(field, source = null) {
  if (!(field == null ? void 0 : field.element)) return;
  if (!completedElements.has(field.element)) {
    completedElements.add(field.element);
    if (source === "profile") progressBreakdown.profileAnswered += 1;
    else if (source === "ai") progressBreakdown.aiAnswered += 1;
    else if (source === "manual") progressBreakdown.manualAnswered += 1;
  }
  updateProgress();
}
function syncExistingAnswers(fieldList) {
  for (const field of fieldList) {
    if (isFieldAnswered(field)) completedElements.add(field.element);
  }
  updateProgress();
}
function handleNewFields(updatedFields) {
  const newFields = updatedFields.filter(
    (field) => !fieldsToFill.some((existing) => existing.element === field.element)
  );
  if (!newFields.length) return;
  fieldsToFill.push(...newFields);
  syncExistingAnswers(newFields);
  _panel == null ? void 0 : _panel.addLog(`${newFields.length} new questions were detected on the page.`);
  if (!isRunning && !isStopped && !isPaused) {
    _panel == null ? void 0 : _panel.addLog("Restarting Autofill for new questions...");
    isRunning = true;
    runFillLoop().catch(console.error);
  }
}
async function processField(field) {
  var _a, _b, _c, _d;
  if (!isContextValid()) {
    return { _invalidated: true };
  }
  const { element, type, label, placeholder, name, ariaLabel, context, maxLength, selectOptions = [] } = field;
  const fieldLabel = getFieldLabel(field);
  const alreadyAnswered = isFieldAnswered(field);
  if (alreadyAnswered && type !== "select") {
    markAnswered(field);
    return;
  }
  if (type === "file") {
    const documentType = detectRequestedDocument(field);
    const savedDocument = getStoredDocument(documentType);
    if (savedDocument) {
      _panel == null ? void 0 : _panel.hideFileAlert();
      _panel == null ? void 0 : _panel.addLog(`Fetching your saved ${savedDocument.label}...`);
      try {
        const response = await safeSendMessage({ action: "GET_DOCUMENT", type: documentType });
        if ((response == null ? void 0 : response._invalidated) || (response == null ? void 0 : response.error) === "SESSION_EXPIRED") return response;
        const docPayload = response == null ? void 0 : response.document;
        const base64 = typeof (docPayload == null ? void 0 : docPayload.pdfBase64) === "string" && docPayload.pdfBase64 || typeof (docPayload == null ? void 0 : docPayload.base64) === "string" && docPayload.base64 || typeof (docPayload == null ? void 0 : docPayload.data) === "string" && docPayload.data || "";
        const filename = typeof (docPayload == null ? void 0 : docPayload.filename) === "string" && docPayload.filename.trim() || savedDocument.filename;
        if (base64) {
          _panel == null ? void 0 : _panel.addLog(`Uploading your saved ${savedDocument.label}.`);
          if (fillFileInput(element, base64, filename)) {
            markAnswered(field, "profile");
            return;
          }
          _panel == null ? void 0 : _panel.addLog(`The page rejected the automatic ${savedDocument.label} upload, so manual review is needed.`);
        }
      } catch {
        _panel == null ? void 0 : _panel.addLog(`Failed to load ${savedDocument.label}.`);
      }
    }
    await notifyIfBackground(
      "AutoApply — File Upload Needed",
      `${_company ? _company + ": " : ""}Please upload a file to continue.`
    );
    pendingFileUploads.push(fieldLabel);
    const uploadCount = pendingFileUploads.length;
    const plural = uploadCount === 1 ? "field" : "fields";
    _panel == null ? void 0 : _panel.showFileAlert(
      `${uploadCount} ${plural} still need${uploadCount === 1 ? "s" : ""} a manual document upload on this page.`
    );
    _panel == null ? void 0 : _panel.addLog(`Skipped ${fieldLabel} — manual upload required.`);
    return;
  }
  let optionList = (selectOptions == null ? void 0 : selectOptions.length) > 0 ? selectOptions : type === "select" && element.tagName === "SELECT" ? getNativeSelectOptions(element) : [];
  if (type === "select" && optionList.length === 0 && element.tagName !== "SELECT") {
    const sniffed = await sniffComboboxOptions(element);
    if (sniffed.length > 0) optionList = sniffed;
  }
  if (type === "radio" || type === "checkbox") {
    const fieldsetEl = element.closest('fieldset, [role="group"]');
    let groupKey;
    let groupContainerEl = fieldsetEl;
    if (fieldsetEl) {
      if (!fieldsetEl._aladdinGid) fieldsetEl._aladdinGid = `gid_${Math.random().toString(36).slice(2)}`;
      groupKey = fieldsetEl._aladdinGid;
    } else {
      let walkEl = element.parentElement;
      for (let d = 0; d < 8 && walkEl && !groupContainerEl; d++) {
        const siblings = walkEl.querySelectorAll(`input[type="${type}"]`);
        if (siblings.length >= 2) {
          const hasLabel = walkEl.querySelector("label, legend, p, span") || (((_b = (_a = walkEl.previousElementSibling) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim().length) ?? 0) > 4;
          if (hasLabel) {
            groupContainerEl = walkEl;
            if (!walkEl._aladdinGid) walkEl._aladdinGid = `gid_${Math.random().toString(36).slice(2)}`;
            groupKey = walkEl._aladdinGid;
          }
        }
        walkEl = walkEl.parentElement;
      }
      if (!groupContainerEl) {
        if (element.name) {
          groupKey = element.name;
        } else {
          const container = element.closest('.field, .form-group, li, [class*="question"]');
          if (container) {
            if (!container._aladdinGid) container._aladdinGid = `gid_${Math.random().toString(36).slice(2)}`;
            groupKey = container._aladdinGid;
          }
        }
      }
    }
    if (groupKey && processedRadioGroups.has(groupKey)) {
      markAnswered(field);
      return;
    }
    if (groupKey) processedRadioGroups.add(groupKey);
    const groupLabel = getRadioGroupLabel(element) || fieldLabel;
    const collectInputOptions = (container) => Array.from(container.querySelectorAll(`input[type="radio"],input[type="checkbox"]`)).filter((el) => el.isConnected).map((el) => {
      var _a2, _b2, _c2, _d2;
      return {
        element: el,
        text: (el.id ? (_b2 = (_a2 = document.querySelector(`label[for="${el.id}"]`)) == null ? void 0 : _a2.textContent) == null ? void 0 : _b2.trim() : null) || ((_d2 = (_c2 = el.closest("label")) == null ? void 0 : _c2.textContent) == null ? void 0 : _d2.replace(el.value, "").trim()) || el.value || ""
      };
    }).filter((o) => o.text.trim().length > 0);
    const groupOptions = groupContainerEl ? collectInputOptions(groupContainerEl) : getRadioGroupOptions(element);
    const optionTexts = groupOptions.map((o) => o.text);
    if (groupOptions.length === 1) {
      const singleOptText = groupOptions[0].text;
      const profileVal = matchFieldToProfile(
        { label: groupLabel, placeholder: "", name: element.name || "", ariaLabel: "" },
        _profile
      );
      if (profileVal !== null) {
        const cands = String(profileVal).toLowerCase().split(/\W+/).filter((w) => w.length > 1);
        const optWords = singleOptText.toLowerCase().split(/\W+/).filter((w) => w.length > 1);
        const isMatch = cands.some((c) => optWords.some((w) => w === c || w.includes(c) || c.includes(w)));
        if (isMatch) {
          await fillRadioGroupOption(groupOptions, String(profileVal));
          markAnswered(field, "profile");
        } else {
          _panel == null ? void 0 : _panel.addLog(`Skipped: "${singleOptText}" — not the profile answer for "${groupLabel}".`);
          markAnswered(field);
        }
      } else {
        _panel == null ? void 0 : _panel.addLog(`Skipped: "${singleOptText}" — single-option group, no profile match.`);
        markAnswered(field);
      }
      return;
    }
    _panel == null ? void 0 : _panel.addLog(`Processing: ${groupLabel}.`);
    const groupProfileValue = matchFieldToProfile(
      { label: groupLabel, placeholder: "", name: element.name || "", ariaLabel: "" },
      _profile
    ) ?? fuzzyMatchFieldToProfile(
      { label: groupLabel, placeholder: "", name: element.name || "", ariaLabel: "" },
      _profile
    );
    if (groupProfileValue !== null) {
      const ok = await fillRadioGroupOption(groupOptions, String(groupProfileValue));
      if (ok) markAnswered(field, "profile");
      return;
    }
    const cacheKey = `radio_${groupLabel}_${optionTexts.join("|")}`.slice(0, 200);
    let answerObj = answerCache[cacheKey];
    if (!answerObj && optionTexts.length > 0) {
      try {
        const response = await safeSendMessage({
          action: "GET_ANSWER",
          payload: {
            fieldLabel: groupLabel,
            fieldContext: context,
            jobTitle: _jobTitle,
            company: _company,
            maxLength: null,
            selectOptions: optionTexts,
            strict: _inVerificationPass
            // stricter AI during verification pass
          }
        });
        if ((response == null ? void 0 : response._invalidated) || (response == null ? void 0 : response.error) === "SESSION_EXPIRED") return response;
        if (response == null ? void 0 : response.answer) {
          answerObj = { answer: response.answer, confidence: response.confidence ?? 100 };
          answerCache[cacheKey] = answerObj;
        }
      } catch {
      }
    }
    if (answerObj) {
      _panel == null ? void 0 : _panel.addAnswer(groupLabel, answerObj.answer);
      const ok = await fillRadioGroupOption(
        groupOptions,
        answerObj.answer,
        answerObj.confidence < 70 ? "warning" : "success"
      );
      if (ok) markAnswered(field, "ai");
      else _panel == null ? void 0 : _panel.addLog(`Could not select option for: ${groupLabel} — please review manually.`);
      return;
    }
    _panel == null ? void 0 : _panel.addLog(`Skipped: ${groupLabel} — please review manually.`);
    return;
  }
  const profileValue = matchFieldToProfile({ label, placeholder, name, ariaLabel }, _profile) ?? fuzzyMatchFieldToProfile({ label, placeholder, name, ariaLabel }, _profile);
  if (profileValue !== null) {
    _panel == null ? void 0 : _panel.addLog(`Filling ${fieldLabel}.`);
    let success = false;
    if (type === "select") {
      success = await fillSelect(element, profileValue, "success", optionList.length ? optionList : null);
    } else if (isLocationField(field) && type !== "textarea") {
      success = await fillLocationWithAutocomplete(element, profileValue);
      if (!success) {
        success = await fillTextInput(element, profileValue, "success", { instant: false });
      }
    } else {
      const useInstant = type === "textarea" || typeof profileValue === "string" && profileValue.length > 80;
      success = await fillTextInput(element, profileValue, "success", { instant: useInstant });
      if (success) {
        await clickAutocompleteSuggestion(element, profileValue);
        await sleep(150);
        if (!((_c = element.value) == null ? void 0 : _c.trim())) success = false;
      }
    }
    if (success) markAnswered(field, "profile");
    return;
  }
  if (type === "select" && optionList.length > 0) {
    const hinted = inferSelectHintFromProfile({ label, placeholder, name, ariaLabel }, _profile);
    if (hinted) {
      _panel == null ? void 0 : _panel.addLog(`Matching ${fieldLabel} to a dropdown option from your profile.`);
      const ok = await fillSelect(element, hinted, "success", optionList);
      if (ok) {
        markAnswered(field, "profile");
        return;
      }
    }
  }
  if (alreadyAnswered && type === "select") {
    markAnswered(field);
    return;
  }
  if (["text", "textarea"].includes(type) && isConditionalFollowUp(element, fieldLabel)) {
    _panel == null ? void 0 : _panel.addLog(`Skipped: ${fieldLabel} — conditional field (linked option not selected).`);
    markAnswered(field);
    return;
  }
  if (["text", "textarea", "email", "url", "tel"].includes(type) || type === "select") {
    const cacheKey = `${fieldLabel}${context || ""}${type === "select" ? JSON.stringify(optionList.map((o) => o.text)) : ""}`.slice(0, 200);
    let answerObj = answerCache[cacheKey];
    if (!answerObj) {
      const useSelectOptions = type === "select" && optionList.length > 0;
      _panel == null ? void 0 : _panel.addLog(
        useSelectOptions ? `Choosing a dropdown option for ${fieldLabel}.` : `Generating an answer for ${fieldLabel}.`
      );
      try {
        const response = await safeSendMessage({
          action: "GET_ANSWER",
          payload: {
            fieldLabel,
            fieldContext: context,
            jobTitle: _jobTitle,
            company: _company,
            maxLength,
            selectOptions: useSelectOptions ? optionList.map((o) => o.text) : void 0,
            strict: _inVerificationPass
            // stricter AI during verification pass
          }
        });
        if ((response == null ? void 0 : response._invalidated) || (response == null ? void 0 : response.error) === "SESSION_EXPIRED") return response;
        if (response == null ? void 0 : response.answer) {
          answerObj = { answer: response.answer, confidence: response.confidence ?? 100 };
          answerCache[cacheKey] = answerObj;
        }
      } catch {
      }
    }
    if (answerObj) {
      const { answer, confidence } = answerObj;
      _panel == null ? void 0 : _panel.addAnswer(fieldLabel, answer);
      const isLowConfidence = confidence < 70;
      const status = isLowConfidence ? "warning" : "success";
      if (isLowConfidence) {
        _panel == null ? void 0 : _panel.addLog(`Requires review: Aladdin is unsure about ${fieldLabel}.`);
      } else {
        _panel == null ? void 0 : _panel.addLog(
          type === "select" && optionList.length ? `Selected an option for ${fieldLabel}.` : `Answered ${fieldLabel} with Aladdin AI.`
        );
      }
      let success = false;
      if (type === "select") {
        success = await fillSelect(element, answer, status, optionList.length ? optionList : null, { noFallback: true });
      } else {
        const instant = type !== "textarea" && typeof answer === "string" && answer.length <= 800 && !answer.includes("\n");
        success = await fillTextInput(element, answer, status, { instant });
        if (success) {
          await clickAutocompleteSuggestion(element, answer);
          await sleep(150);
          if (!((_d = element.value) == null ? void 0 : _d.trim())) success = false;
        }
      }
      if (success) markAnswered(field, "ai");
      return;
    }
  }
  _panel == null ? void 0 : _panel.addLog(`Skipped: ${fieldLabel} — will review in verification pass.`);
  return { success: true };
}
async function runVerificationPass() {
  var _a, _b, _c;
  if (!isContextValid() || isStopped) return;
  _inVerificationPass = true;
  _panel == null ? void 0 : _panel.addLog("Verifying all answers against your profile…");
  const freshFields = scanFields(_platform, () => {
  });
  for (const f of freshFields) {
    if (!fieldsToFill.some((existing) => existing.element === f.element)) {
      fieldsToFill.push(f);
    }
  }
  processedRadioGroups = /* @__PURE__ */ new Set();
  let corrections = 0;
  for (const field of fieldsToFill) {
    if (!isContextValid() || isStopped) break;
    if (!((_a = field.element) == null ? void 0 : _a.isConnected)) continue;
    const { type, label, placeholder, name: fieldName, ariaLabel } = field;
    if (type === "file") continue;
    if (type === "radio" || type === "checkbox") {
      await processField(field);
      continue;
    }
    const profileValue = matchFieldToProfile(
      { label, placeholder, name: fieldName, ariaLabel },
      _profile
    );
    if (profileValue !== null) {
      const current = ((_b = field.element.value) == null ? void 0 : _b.trim()) ?? "";
      const expected = String(profileValue).trim();
      if (current !== expected) {
        if (type === "select") {
          const opts = ((_c = field.selectOptions) == null ? void 0 : _c.length) ? field.selectOptions : getNativeSelectOptions(field.element);
          await fillSelect(field.element, profileValue, "success", opts.length ? opts : null);
        } else {
          await fillTextInput(field.element, profileValue, "success", { instant: true });
        }
        markAnswered(field, "profile");
        corrections++;
      }
      continue;
    }
    if (!isFieldAnswered(field)) {
      await processField(field);
      corrections++;
    }
  }
  if (corrections > 0) {
    _panel == null ? void 0 : _panel.addLog(`Verification complete — corrected ${corrections} answer(s) to match your profile.`);
  } else {
    _panel == null ? void 0 : _panel.addLog("Verification complete — all answers match your profile.");
  }
  _inVerificationPass = false;
}
async function runFillLoop() {
  var _a;
  if (!isContextValid()) {
    isRunning = false;
    return;
  }
  await sleep(15);
  try {
    while (currentIndex < fieldsToFill.length && !isStopped) {
      if (!isContextValid()) {
        stopObserver();
        break;
      }
      while (isPaused && !isStopped) {
        await sleep(120);
        if (!isContextValid()) {
          stopObserver();
          isStopped = true;
          break;
        }
      }
      if (isStopped) break;
      const field = fieldsToFill[currentIndex];
      if ((_a = field == null ? void 0 : field.element) == null ? void 0 : _a.isConnected) {
        if (["workday", "ashby", "lever", "generic", "generic-weak"].includes(_platform) && document.visibilityState !== "hidden") {
          await scrollFieldIntoView(field.element);
        }
        const wasAnswered = completedElements.has(field.element);
        try {
          const result = await processField(field);
          if ((result == null ? void 0 : result._invalidated) || (result == null ? void 0 : result.error) === "SESSION_EXPIRED") {
            stopObserver();
            break;
          }
          if (!wasAnswered && !completedElements.has(field.element) && field.type !== "file") {
            failedFields.push(field);
          }
        } catch (error) {
          const msg = (error == null ? void 0 : error.message) ?? String(error);
          if (msg.includes("Extension context invalidated") || msg.includes("Access to storage")) {
            stopObserver();
            break;
          }
          console.warn("Aladdin: field processing error", error);
        }
      }
      currentIndex += 1;
      if (document.visibilityState !== "hidden") {
        await sleep(8 + Math.random() * 17);
      }
    }
    stopObserver();
    if (failedFields.length > 0 && !isStopped && isContextValid()) {
      _panel == null ? void 0 : _panel.addLog(`Retrying ${failedFields.length} field(s) that didn't fill…`);
      const stillFailing = await retryFailedFields(
        failedFields,
        async (field) => {
          var _a2;
          if (!((_a2 = field.element) == null ? void 0 : _a2.isConnected)) return true;
          await scrollFieldIntoView(field.element);
          await processField(field);
          return completedElements.has(field.element);
        }
      );
      for (const field of stillFailing) {
        const label = field.label || field.placeholder || field.name || "Unknown field";
        _panel == null ? void 0 : _panel.addLog(`Could not fill: ${label} — please fill manually`);
      }
      failedFields = [];
    }
    if (!isStopped && isContextValid()) {
      await runVerificationPass();
    }
    const shouldAdvance = _autoAdvanceEnabled || _platform === "workday";
    if (!isStopped && isContextValid() && shouldAdvance && fieldsToFill.length > 0) {
      await _tryAutoAdvance();
      return;
    }
    if (!isStopped && isContextValid()) {
      if (fieldsToFill.length === 0) {
        _panel == null ? void 0 : _panel.addLog("No fillable questions were detected on this page.");
        _panel == null ? void 0 : _panel.setState("idle");
      } else {
        const unanswered = fieldsToFill.filter((f) => {
          var _a2;
          return ((_a2 = f.element) == null ? void 0 : _a2.isConnected) && !isFieldAnswered(f);
        }).length;
        if (unanswered > 0) {
          _panel == null ? void 0 : _panel.addLog(`Done — ${unanswered} field(s) need manual review before submitting.`);
        } else {
          _panel == null ? void 0 : _panel.addLog("All questions filled. Review and submit your application!");
        }
        _panel == null ? void 0 : _panel.setState("done");
        _panel == null ? void 0 : _panel.celebrateSuccess();
      }
    }
  } finally {
    isRunning = false;
    isPaused = false;
    _cleanupBackgroundSession();
  }
}
async function startFill({ source = "panel" } = {}) {
  var _a;
  if (!_panel) {
    return { success: false, error: "No panel available." };
  }
  if (isRunning) {
    _panel.show();
    if (source === "panel") _panel.open();
    _panel.addLog("Autofill is already running on this page.");
    return { success: true, alreadyRunning: true };
  }
  _profile = await (_ensureProfile == null ? void 0 : _ensureProfile(true));
  if (!_profile) {
    _panel.show();
    _panel.setState("idle");
    _panel.addLog("Not connected to Aladdin. Use the browser extension popup to sign in.");
    return { success: false, error: "Not connected to Aladdin." };
  }
  _panel.resetSession();
  _syncPanelProfileData == null ? void 0 : _syncPanelProfileData();
  _panel.setJobMeta(_jobTitle, _company, _platform);
  _panel.show();
  if (source === "panel") {
    _panel.open();
  } else {
    _panel.collapse();
  }
  _panel.setState("running");
  _panel.addLog("Starting Auto Fill Application on this page.");
  stopObserver();
  fieldsToFill = [];
  currentIndex = 0;
  answerCache = {};
  isStopped = false;
  isPaused = false;
  isRunning = true;
  completedElements = /* @__PURE__ */ new Set();
  progressBreakdown = { profileAnswered: 0, aiAnswered: 0, manualAnswered: 0 };
  pendingFileUploads = [];
  failedFields = [];
  processedRadioGroups = /* @__PURE__ */ new Set();
  _inVerificationPass = false;
  resetBackgroundWarningDismissal();
  if (typeof navigator !== "undefined" && typeof ((_a = navigator.locks) == null ? void 0 : _a.request) === "function") {
    const lockHeld = new Promise((resolve) => {
      _lockRelease = resolve;
    });
    navigator.locks.request("aladdin-autofill", { mode: "shared" }, () => lockHeld).catch(() => {
    });
  }
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
  }
  if (BACKGROUND_UNRELIABLE_PLATFORMS.includes(_platform)) {
    const label = PLATFORM_LABELS[_platform] ?? _platform;
    _visibilityHandler = () => {
      if (!isRunning) return;
      if (document.visibilityState === "hidden") {
        showBackgroundWarningBanner(label);
      } else {
        hideBackgroundWarningBanner();
      }
    };
    document.addEventListener("visibilitychange", _visibilityHandler);
  } else {
    _visibilityHandler = null;
  }
  fieldsToFill = scanFields(_platform, handleNewFields);
  syncExistingAnswers(fieldsToFill);
  const atsIframes = collectAtsIframes(document);
  const hasEmbeddedForm = atsIframes.length > 0;
  let iframeFillPromise = Promise.resolve(null);
  if (hasEmbeddedForm) {
    iframeFillPromise = fillAllAtsIframes({
      profile: _profile,
      jobTitle: _jobTitle,
      company: _company,
      panel: _panel
    }).catch(() => null);
  }
  if (fieldsToFill.length) {
    _panel.addLog(`Detected ${fieldsToFill.length} fillable questions.`);
  } else if (!hasEmbeddedForm) {
    _panel.addLog("Scanning the page for fillable questions.");
  }
  if (fieldsToFill.length === 0 && hasEmbeddedForm) {
    iframeFillPromise.then((result) => {
      var _a2;
      if (!isContextValid()) return;
      if (result && (result.filled > 0 || result.replied > 0)) {
        _panel.setState("done");
        (_a2 = _panel.celebrateSuccess) == null ? void 0 : _a2.call(_panel);
      } else {
        _panel.setState("idle");
      }
    }).finally(() => {
      isRunning = false;
      _cleanupBackgroundSession();
    });
    return { success: true };
  }
  runFillLoop().catch((error) => {
    console.error("Auto fill failed:", error);
    _panel.addLog("Autofill stopped because of an unexpected error.");
    _panel.setState("paused");
    stopObserver();
    isRunning = false;
    _cleanupBackgroundSession();
  });
  return { success: true };
}
let panel = null;
let profile = null;
function normalizeText(value) {
  return typeof value === "string" ? value : "";
}
function cloneCustomQA(customQA = []) {
  return customQA.map((entry) => ({
    question: normalizeText(entry == null ? void 0 : entry.question),
    answer: normalizeText(entry == null ? void 0 : entry.answer)
  }));
}
function getAutoApplyKeys(sections = []) {
  return sections.flatMap((section) => {
    var _a;
    return ((_a = section == null ? void 0 : section.fields) == null ? void 0 : _a.map((field) => field.key)) ?? [];
  });
}
function decodeUserContextSnapshot(snapshot, autoApplyKeys, onboardingAnswers = []) {
  const answers = {};
  const indexedCustom = [];
  const looseCustom = [];
  const keySet = new Set(autoApplyKeys);
  for (const [key, rawValue] of Object.entries(snapshot ?? {})) {
    if (keySet.has(key) && typeof rawValue === "string") {
      answers[key] = rawValue;
      continue;
    }
    if (key.startsWith("aa_custom_") && rawValue && typeof rawValue === "object") {
      const index = Number.parseInt(key.replace("aa_custom_", ""), 10);
      const entry = {
        question: normalizeText(rawValue.questionLabel),
        answer: normalizeText(rawValue.value)
      };
      if (Number.isFinite(index)) {
        indexedCustom[index] = entry;
      } else {
        looseCustom.push(entry);
      }
      continue;
    }
    if (typeof rawValue === "string" && rawValue.trim()) {
      looseCustom.push({ question: key, answer: rawValue });
    }
  }
  for (const onboardingEntry of onboardingAnswers ?? []) {
    const key = normalizeText(onboardingEntry == null ? void 0 : onboardingEntry.questionKey);
    const answer = normalizeText(onboardingEntry == null ? void 0 : onboardingEntry.answerText).trim();
    if (keySet.has(key) && answer && !answers[key]) {
      answers[key] = answer;
    }
  }
  return {
    answers,
    customQA: [...indexedCustom.filter(Boolean), ...looseCustom]
  };
}
function encodeUserContextSnapshot(answers, customQA, autoApplyKeys) {
  const payload = {};
  for (const key of autoApplyKeys) {
    const value = normalizeText(answers == null ? void 0 : answers[key]).trim();
    if (value) payload[key] = value;
  }
  cloneCustomQA(customQA).map((entry) => ({
    question: normalizeText(entry.question).trim(),
    answer: normalizeText(entry.answer).trim()
  })).filter((entry) => entry.question || entry.answer).forEach((entry, index) => {
    payload[`aa_custom_${index}`] = {
      questionLabel: entry.question,
      value: entry.answer
    };
  });
  return payload;
}
function buildPanelProfileData(currentProfile) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (!currentProfile) {
    return {
      user: null,
      sections: [],
      answers: {},
      customQA: [],
      documents: {
        resume: { ready: false, filename: "", description: "Add a default resume to upload it automatically." },
        coverLetter: { ready: false, filename: "", description: "Add a saved cover letter to upload it automatically." }
      }
    };
  }
  const sections = Array.isArray(currentProfile.autoApplySections) ? currentProfile.autoApplySections : [];
  const { answers, customQA } = decodeUserContextSnapshot(
    currentProfile.userContext,
    getAutoApplyKeys(sections),
    currentProfile.onboardingAnswers
  );
  return {
    user: currentProfile.user ?? null,
    sections,
    answers,
    customQA,
    documents: {
      resume: {
        ready: !!(((_a = currentProfile.resume) == null ? void 0 : _a.id) || ((_b = currentProfile.resume) == null ? void 0 : _b.pdfBase64)),
        filename: normalizeText((_c = currentProfile.resume) == null ? void 0 : _c.filename),
        description: ((_d = currentProfile.resume) == null ? void 0 : _d.id) || ((_e = currentProfile.resume) == null ? void 0 : _e.pdfBase64) ? "Your default resume will be uploaded automatically when resume fields appear." : "No default resume is available yet."
      },
      coverLetter: {
        ready: !!(((_f = currentProfile.coverLetter) == null ? void 0 : _f.id) || ((_g = currentProfile.coverLetter) == null ? void 0 : _g.pdfBase64)),
        filename: normalizeText(((_h = currentProfile.coverLetter) == null ? void 0 : _h.filename) || "cover-letter.pdf"),
        description: ((_i = currentProfile.coverLetter) == null ? void 0 : _i.id) || ((_j = currentProfile.coverLetter) == null ? void 0 : _j.pdfBase64) ? "Your saved cover letter will be uploaded automatically when cover letter fields appear." : "No saved cover letter is available yet."
      }
    }
  };
}
async function fetchProfile(force = false) {
  try {
    const response = await safeSendMessage({ action: "GET_PROFILE", force });
    return (response == null ? void 0 : response.profile) ?? null;
  } catch {
    return null;
  }
}
async function ensureProfile(force = false) {
  if (!force && profile) {
    syncPanelProfileData();
    return profile;
  }
  const nextProfile = await fetchProfile(force);
  if (nextProfile) {
    profile = nextProfile;
    syncPanelProfileData();
    return profile;
  }
  if (force) syncPanelProfileData();
  return profile;
}
function syncPanelProfileData() {
  panel == null ? void 0 : panel.setProfileData(buildPanelProfileData(profile));
}
function getProfile() {
  return profile;
}
function clearProfile() {
  profile = null;
}
async function saveSettingsDraft(draft) {
  const currentProfile = await ensureProfile();
  if (!currentProfile) {
    throw new Error("You need to be signed in to save your profile details. Please connect the extension first.");
  }
  const sections = Array.isArray(draft == null ? void 0 : draft.sections) && draft.sections.length ? draft.sections : buildPanelProfileData(currentProfile).sections;
  const autoApplyKeys = getAutoApplyKeys(sections);
  const payload = encodeUserContextSnapshot((draft == null ? void 0 : draft.answers) ?? {}, (draft == null ? void 0 : draft.customQA) ?? [], autoApplyKeys);
  const response = await safeSendMessage({
    action: "SET_USER_CONTEXT",
    payload: { context: payload }
  });
  if (response == null ? void 0 : response._invalidated) return response;
  if (response == null ? void 0 : response.error) throw new Error(response.error);
  profile = (response == null ? void 0 : response.profile) ?? await fetchProfile(true);
  syncPanelProfileData();
  panel == null ? void 0 : panel.addLog("Saved bookmark settings to your Aladdin profile.");
  return profile;
}
async function saveLearnedAnswer(question, answer) {
  const currentProfile = await ensureProfile();
  if (!currentProfile) return;
  const panelProfileData = buildPanelProfileData(currentProfile);
  const customQA = cloneCustomQA(panelProfileData.customQA);
  const normalizedQuestion = normalizeText(question).trim().toLowerCase();
  const matchIndex = customQA.findIndex(
    (entry) => normalizeText(entry.question).trim().toLowerCase() === normalizedQuestion
  );
  if (matchIndex >= 0) {
    customQA[matchIndex] = { question, answer };
  } else {
    customQA.push({ question, answer });
  }
  const payload = encodeUserContextSnapshot(
    panelProfileData.answers,
    customQA,
    getAutoApplyKeys(panelProfileData.sections)
  );
  const response = await safeSendMessage({
    action: "SET_USER_CONTEXT",
    payload: { context: payload }
  });
  if (!(response == null ? void 0 : response.error)) {
    profile = (response == null ? void 0 : response.profile) ?? await fetchProfile(true);
    syncPanelProfileData();
  }
}
function getOrCreatePanel(platform2, jobTitle2, company2, onStartFill, forceGeneric = false) {
  if (window !== window.top) return null;
  if (!platform2 && !forceGeneric) return null;
  if (!panel) {
    panel = injectPanel();
    panel.onStart = () => onStartFill({ source: "panel" });
    panel.onPause = () => {
      panel.setState("paused");
      panel.addLog("Autofill paused.");
    };
    panel.onResume = () => {
      panel.setState("running");
      panel.addLog("Autofill resumed.");
    };
    panel.onStop = () => {
      stop();
      panel.setState("paused");
      panel.addLog("Autofill stopped.");
    };
    panel.onSkip = () => {
      panel.addLog("Skip step — not wired to the engine yet.");
    };
    panel.onSignIn = () => {
      safeSendMessage({ action: "SIGN_IN" }).catch(() => {
      });
    };
    panel.onOpenAladdin = () => {
      safeSendMessage({ action: "OPEN_ALADDIN" }).catch(() => {
      });
    };
    panel.onConnectPat = async (raw) => {
      panel.patConnectBusy = true;
      panel.patConnectError = null;
      panel._renderPanel();
      try {
        const r = await safeSendMessage({ action: "CONNECT_PAT", token: raw });
        if (r == null ? void 0 : r._invalidated) {
          panel.patConnectBusy = false;
          panel._renderPanel();
          return;
        }
        if (r == null ? void 0 : r.error) {
          panel.patConnectError = r.error;
          panel.patConnectBusy = false;
          panel._renderPanel();
          return;
        }
        panel._patDraft = "";
        profile = await fetchProfile(true);
        syncPanelProfileData();
        panel.patConnectBusy = false;
        panel.patConnectError = null;
        panel._renderPanel();
        panel.addLog("Connected with your extension secret key.");
      } catch {
        panel.patConnectError = "Something went wrong. Try again.";
        panel.patConnectBusy = false;
        panel._renderPanel();
      }
    };
    panel.onDisconnect = async () => {
      try {
        await safeSendMessage({ action: "CLEAR_AUTH" });
      } catch {
      }
      clearProfile();
      panel._patDraft = "";
      syncPanelProfileData();
      panel.addLog("Disconnected from Aladdin.");
      panel.setSettingsMessage(
        "You have been disconnected. Generate a new key under Account → Auto Apply to reconnect.",
        "info"
      );
      panel._renderPanel();
    };
    panel.onOpenSettings = () => {
      panel.setSettingsMessage("Refreshing your saved Aladdin details...", "info");
      ensureProfile(true).then((currentProfile) => {
        if (!currentProfile) {
          panel.setSettingsMessage("Please connect your extension key under Account → Auto Apply to view and edit your profile.", "error");
          return;
        }
        panel.setSettingsMessage("Changes saved here stay in sync with Auto Apply in Account Settings.", "info");
      }).catch(() => {
        panel.setSettingsMessage("Could not load your profile right now. Check your connection and try again.", "error");
      });
    };
    panel.onResumePreview = async () => {
      try {
        panel.addLog("Opening resume preview…");
        const r = await safeSendMessage({ action: "OPEN_DOCUMENT", type: "resume" });
        if (r == null ? void 0 : r._invalidated) return;
        if (r == null ? void 0 : r.error) {
          panel.setSettingsMessage(r.error, "error");
          panel.addLog(`Resume preview failed — ${r.error}`);
          return;
        }
      } catch {
        panel.setSettingsMessage("Could not open the resume preview. Please try again.", "error");
        panel.addLog("Resume preview failed — could not reach Aladdin.");
      }
    };
    panel.onAutoAdvanceChange = (enabled) => {
      setAutoAdvanceEnabled(enabled);
    };
    panel.onSaveSettings = async (draft) => {
      panel.setSettingsSaving(true);
      panel.setSettingsMessage("Saving your Aladdin application profile...", "info");
      try {
        await saveSettingsDraft(draft);
        panel.setSettingsMessage("Saved to your Aladdin profile.", "success");
      } catch (error) {
        panel.setSettingsMessage((error == null ? void 0 : error.message) ?? "Could not save your profile. Please try again.", "error");
      } finally {
        panel.setSettingsSaving(false);
      }
    };
  }
  panel.setJobMeta(jobTitle2, company2, platform2);
  panel.setPlatform(platform2);
  syncPanelProfileData();
  return panel;
}
function getPanel() {
  return panel;
}
installErrorBoundary();
const IS_SUBFRAME = (() => {
  try {
    return window !== window.top;
  } catch {
    return true;
  }
})();
if (IS_SUBFRAME) {
  try {
    const host2 = location.hostname;
    if (isAtsIframeHost(host2)) {
      bootHeadlessFrame();
    }
  } catch {
  }
} else {
  initIframeCoordinator();
}
let platform = null;
let strength = null;
let jobTitle = "";
let company = "";
let lastLocationHref = location.href;
let panelEverInjected = false;
let mutationObserver = null;
let mutationDebounceTimer = null;
let dormancyTimer = null;
let detectionPaused = false;
let applyClickRetryTimer = null;
let applyClickRetriesLeft = 0;
const MUTATION_DEBOUNCE_MS = 500;
const DORMANCY_MS = 3e4;
const APPLY_CLICK_RETRY_INTERVAL_MS = 500;
const APPLY_CLICK_RETRY_COUNT = 10;
const APPLY_BUTTON_TEXTS = /* @__PURE__ */ new Set([
  "apply",
  "apply now",
  "apply for this job",
  "apply for job",
  "start application",
  "submit application",
  "easy apply",
  "begin application"
]);
async function runInitialBoot() {
  if (!isContextValid()) return;
  runDetection();
  installReDetectionTriggers();
}
function installReDetectionTriggers() {
  try {
    const _push = history.pushState;
    const _replace = history.replaceState;
    history.pushState = function(...args) {
      const r = _push.apply(this, args);
      scheduleDetection("pushstate");
      return r;
    };
    history.replaceState = function(...args) {
      const r = _replace.apply(this, args);
      scheduleDetection("replacestate");
      return r;
    };
  } catch {
  }
  window.addEventListener("popstate", () => scheduleDetection());
  window.addEventListener("hashchange", () => scheduleDetection());
  startMutationObserver();
  document.addEventListener("click", onDocumentClickCapture, true);
  document.addEventListener("click", onDocumentClickCapture, false);
  armDormancyTimer();
}
function startMutationObserver() {
  if (mutationObserver) return;
  try {
    mutationObserver = new MutationObserver(() => {
      if (detectionPaused) return;
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(() => {
        mutationDebounceTimer = null;
        scheduleDetection("mutation");
      }, MUTATION_DEBOUNCE_MS);
    });
    mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false
    });
  } catch {
  }
}
function stopMutationObserver() {
  try {
    mutationObserver == null ? void 0 : mutationObserver.disconnect();
  } catch {
  }
  mutationObserver = null;
  if (mutationDebounceTimer) {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
}
function armDormancyTimer() {
  if (dormancyTimer) clearTimeout(dormancyTimer);
  dormancyTimer = setTimeout(() => {
    if (!platform) {
      detectionPaused = true;
      stopMutationObserver();
    }
  }, DORMANCY_MS);
}
function wakeFromDormancy() {
  if (!detectionPaused) return;
  detectionPaused = false;
  startMutationObserver();
  armDormancyTimer();
}
function onDocumentClickCapture(e) {
  var _a, _b;
  try {
    const el = (_b = (_a = e.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, 'a, button, [role="button"], input[type="submit"], input[type="button"]');
    if (!el) return;
    const text = (el.textContent || el.value || el.getAttribute("aria-label") || "").trim().toLowerCase();
    if (!text || text.length > 40) return;
    if (!APPLY_BUTTON_TEXTS.has(text)) return;
    wakeFromDormancy();
    startApplyClickRetry();
  } catch {
  }
}
function startApplyClickRetry() {
  applyClickRetriesLeft = APPLY_CLICK_RETRY_COUNT;
  if (applyClickRetryTimer) clearInterval(applyClickRetryTimer);
  applyClickRetryTimer = setInterval(() => {
    applyClickRetriesLeft -= 1;
    scheduleDetection();
    if (applyClickRetriesLeft <= 0 || platform) {
      clearInterval(applyClickRetryTimer);
      applyClickRetryTimer = null;
    }
  }, APPLY_CLICK_RETRY_INTERVAL_MS);
}
let pendingDetectionTimer = null;
function scheduleDetection(reason) {
  wakeFromDormancy();
  if (pendingDetectionTimer) return;
  pendingDetectionTimer = setTimeout(() => {
    pendingDetectionTimer = null;
    runDetection();
  }, 150);
}
async function runDetection(reason) {
  if (!isContextValid()) return;
  const urlChanged = location.href !== lastLocationHref;
  lastLocationHref = location.href;
  const detection = detectJobApplicationPageDetailed();
  const nextPlatform = detection.platform;
  const nextStrength = detection.strength;
  const transitionedToMatch = !platform && !!nextPlatform;
  const strengthChanged = nextStrength !== strength;
  const platformChanged = nextPlatform !== platform;
  platform = nextPlatform;
  strength = nextStrength;
  if (!platform) {
    return;
  }
  armDormancyTimer();
  const meta = getJobMeta();
  const titleChanged = meta.jobTitle && meta.jobTitle !== jobTitle;
  const companyChanged = meta.company && meta.company !== company;
  jobTitle = meta.jobTitle || jobTitle;
  company = meta.company || company;
  if (transitionedToMatch || !panelEverInjected) {
    await attachPanelForFirstTime();
    return;
  }
  if (urlChanged || titleChanged || companyChanged || platformChanged || strengthChanged) {
    const panel2 = getPanel();
    if (panel2) {
      panel2.setJobMeta(jobTitle, company, platform);
      if (urlChanged) {
        panel2.addLog("New job detected — click Start to fill this application.");
      }
      if (urlChanged) pause();
    }
    if (strength === "strong" && panel2) {
      panel2.show();
    }
  }
}
async function attachPanelForFirstTime(reason) {
  const panel2 = getOrCreatePanel(platform, jobTitle, company, startFillWrapper, true);
  if (!panel2) return;
  panelEverInjected = true;
  panel2.setJobMeta(jobTitle, company, platform);
  panel2.setState("idle");
  init({
    panel: panel2,
    profile: getProfile(),
    jobTitle,
    company,
    platform,
    ensureProfile,
    saveLearnedAnswer,
    syncPanelProfileData
  });
  panel2.show();
  ensureProfile().catch(() => {
  });
}
async function startFillWrapper(opts) {
  const currentPanel = getOrCreatePanel(platform, jobTitle, company, startFillWrapper, true);
  if (!currentPanel) {
    return { success: false, error: "This page is not a supported job application." };
  }
  setPanel(currentPanel);
  setProfile(getProfile());
  setJobMeta(jobTitle, company);
  return startFill(opts);
}
if (!IS_SUBFRAME) chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "SESSION_EXPIRED") {
    pause();
    clearProfile();
    const panel2 = getPanel();
    panel2 == null ? void 0 : panel2.addLog("Session Expired. Please sign in to Aladdin again.");
    panel2 == null ? void 0 : panel2.setState("idle");
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "SESSION_UPDATED") {
    ensureProfile(true).then((freshProfile) => {
      if (freshProfile) {
        setProfile(freshProfile);
        const panel2 = getPanel();
        panel2 == null ? void 0 : panel2.addLog("Signed in to Aladdin. Ready to auto-fill.");
        panel2 == null ? void 0 : panel2.setState("idle");
      }
    }).catch(() => {
    });
    sendResponse({ success: true });
    return true;
  }
  const handle = async () => {
    if (!isContextValid()) {
      return { error: "The extension was reloaded or updated. Please refresh the page and try again." };
    }
    switch (message.action) {
      case "GET_AUTO_APPLY_STATE": {
        const panel2 = getPanel();
        const snapshot = (panel2 == null ? void 0 : panel2.getSnapshot()) ?? {
          visible: false,
          open: false,
          state: "idle",
          jobTitle,
          company,
          platform: platform || "",
          progress: {
            totalQuestions: 0,
            answeredQuestions: 0,
            profileAnswered: 0,
            aiAnswered: 0,
            manualAnswered: 0,
            pendingQuestions: 0
          },
          requiresInput: false
        };
        return { supported: !!platform, snapshot };
      }
      case "SHOW_AUTO_APPLY_PANEL":
      case "OPEN_AUTO_APPLY_PANEL":
      case "OPEN_PANEL": {
        const currentPlatform = platform || "generic";
        const currentPanel = getOrCreatePanel(currentPlatform, jobTitle, company, startFillWrapper, true);
        if (!currentPanel) {
          return { success: false, error: "Could not create panel on this page.", supported: false };
        }
        await ensureProfile(true);
        currentPanel.show();
        currentPanel.open();
        return {
          success: true,
          supported: currentPlatform !== "generic",
          snapshot: currentPanel.getSnapshot()
        };
      }
      case "HIDE_AUTO_APPLY_PANEL": {
        const panel2 = getPanel();
        if (!panel2) {
          return {
            success: false,
            error: "The AutoApply panel is not open on this page.",
            supported: !!platform && platform !== "generic"
          };
        }
        panel2.hide();
        return {
          success: true,
          supported: !!platform && platform !== "generic",
          snapshot: panel2.getSnapshot()
        };
      }
      case "START_AUTO_APPLY": {
        const result = await startFillWrapper({ source: "popup" });
        const currentPanel = getOrCreatePanel(
          platform || "generic",
          jobTitle,
          company,
          startFillWrapper,
          true
        );
        return { ...result, supported: true, snapshot: (currentPanel == null ? void 0 : currentPanel.getSnapshot()) ?? null };
      }
      default:
        return { error: "Something went wrong. Please refresh the page and try again." };
    }
  };
  handle().then(sendResponse).catch((error) => {
    sendResponse({ error: (error == null ? void 0 : error.message) ?? String(error) });
  });
  return true;
});
if (!IS_SUBFRAME) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runInitialBoot);
  } else {
    runInitialBoot();
  }
}
//# sourceMappingURL=content.js.map
