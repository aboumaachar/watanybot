(function () {
  "use strict";
  var VERSION = "v1.0.2";
  var API_BASE = "/mcp";
  var ACTIVITY_KEY = "watany-smart-attention-events-v1";
  var CATALOG_KEYS = ["salary", "jobs", "marketplace", "forms", "procedures", "news", "community"];
  var FALLBACK_RECOMMENDED = [
    { id: "salary", title: "Ø§Ù„Ù…Ø¹Ø§Ø´", summary: "Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¹Ø§Ø´ ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø±Ø§ØªØ¨ ÙˆØ§Ù„Ø¨Ø¯Ù„Ø§Øª ÙˆØ§Ù„ØªØ¹ÙˆÙŠØ¶Ø§Øª.", kind: "Ø­Ù‚ÙˆÙ‚", source: "Ø­Ù‚ÙˆÙ‚ÙŠ ÙˆÙ…Ø¹Ø§Ø´ÙŠ", href: "/salary" },
    { id: "jobs", title: "Ø§Ù„ÙˆØ¸Ø§Ø¦Ù", summary: "ÙØ±Øµ Ø¹Ù…Ù„ ÙˆØ®Ø¯Ù…Ø§Øª Ù…Ù‡Ù†ÙŠØ© ÙŠÙ…ÙƒÙ† Ø£Ù† ØªÙ‡Ù… Ø§Ù„Ø¹Ø³ÙƒØ±ÙŠÙŠÙ† Ø§Ù„Ù…ØªÙ‚Ø§Ø¹Ø¯ÙŠÙ†.", kind: "ÙˆØ¸Ø§Ø¦Ù", source: "Ø§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„ÙØ±Øµ", href: "/jobs" },
    { id: "procedures", title: "Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª", summary: "Ù…Ø³Ø§Ø±Ø§Øª ÙˆØ¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø±Ø³Ù…ÙŠØ© ÙŠØ­ØªØ§Ø¬Ù‡Ø§ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¨ØµÙˆØ±Ø© Ù…ØªÙƒØ±Ø±Ø©.", kind: "Ù…Ø¹Ø§Ù…Ù„Ø§Øª", source: "Ù…Ø¹Ø§Ù…Ù„Ø§ØªÙŠ", href: "/procedures" }
  ];

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function currentPath() {
    var path = window.location.pathname || "/";
    return path.length > 1 ? path.replace(/\/+$/, "") : path;
  }
  function safeArray(value) { return Array.isArray(value) ? value : []; }
  async function fetchJson(url) {
    var response = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP_" + response.status);
    return response.json();
  }
  function featureKeyFor(item) {
    if (!item) return null;
    var route = String(item.href || "").replace(/^\//, "").split("/")[0];
    return CATALOG_KEYS.indexOf(route) >= 0 ? route : null;
  }
  function localActivityRows() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(ACTIVITY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function activityCounts() {
    var counts = Object.create(null);
    localActivityRows().slice(-120).forEach(function (row) {
      if (row && row.type === "open_item" && typeof row.id === "string") counts[row.id] = (counts[row.id] || 0) + 1;
    });
    return counts;
  }
  function recordOpen(item) {
    if (!item) return;
    try {
      var rows = localActivityRows();
      rows.push({ type: "open_item", id: item.id || featureKeyFor(item) || "unknown", at: Date.now(), path: currentPath() });
      window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(rows.slice(-120)));
    } catch (_) {}
    var featureKey = featureKeyFor(item);
    if (!featureKey) return;
    fetch(API_BASE + "/api/engagement/event", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ featureKey: featureKey })
    }).catch(function () {});
  }
  function openItem(item) {
    recordOpen(item);
    if (!item || !item.href) return;
    window.location.assign(item.href);
  }
  function badge(text, gold) {
    var node = create("span", "watany-listing-card__badge" + (gold ? " watany-listing-card__badge--gold" : ""), text);
    return node;
  }
  function card(item, index, showDemand) {
    var article = create("article", "watany-listing-card");
    article.setAttribute("data-w20-engagement-item", item.id || String(index));
    var top = create("div", "watany-listing-card__top");
    var body = create("div", "watany-listing-card__body");
    body.appendChild(create("h3", "watany-listing-card__title", item.title || ""));
    body.appendChild(create("p", "watany-listing-card__summary", item.summary || ""));
    var meta = create("div", "watany-listing-card__meta");
    if (item.kind) meta.appendChild(badge(item.kind, false));
    if (item.source) meta.appendChild(badge(item.source, true));
    if (showDemand && Number(item.demandCount) > 0) meta.appendChild(create("span", "watany-listing-card__rank", Number(item.demandCount) + " Ø·Ù„Ø¨ Ø®Ù„Ø§Ù„ 30 ÙŠÙˆÙ…Ø§Ù‹"));
    body.appendChild(meta); top.appendChild(body); article.appendChild(top);
    var actions = create("div", "watany-listing-card__actions");
    var button = create("button", "watany-listing-card__button watany-listing-card__button--primary", "Ø§ÙØªØ­");
    button.type = "button"; button.addEventListener("click", function () { openItem(item); });
    actions.appendChild(button); article.appendChild(actions);
    return article;
  }
  function renderSurface(title, description, items, emptyText, showDemand) {
    var main = document.querySelector("main.watany-recovery-main[data-watany-route-surface='true']");
    if (!main) return false;
    var section = main.querySelector(":scope > main .watany-listing-surface") || main.querySelector(":scope > .watany-listing-surface");
    if (!section) {
      main.textContent = "";
      section = create("section", "watany-listing-surface w20-engagement-surface");
      main.appendChild(section);
    }
    section.classList.add("w20-engagement-surface"); section.dir = "rtl"; section.setAttribute("data-w20-engagement-surface", title);
    var header = section.querySelector(":scope > .watany-listing-surface__header");
    if (!header) { header = create("header", "watany-listing-surface__header"); section.insertBefore(header, section.firstChild); }
    header.classList.add("w20-engagement-header"); header.textContent = "";
    header.appendChild(create("h1", "watany-listing-surface__title", title));
    if (description) header.appendChild(create("p", "w20-engagement-description", description));
    var grid = section.querySelector(":scope > .watany-listing-surface__grid");
    if (!grid) { grid = create("div", "watany-listing-surface__grid"); section.appendChild(grid); }
    grid.querySelectorAll(":scope > article.watany-listing-card, :scope > .w20-engagement-empty").forEach(function (node) { node.remove(); });
    var anchor = grid.firstChild; var fragment = document.createDocumentFragment();
    if (!items.length) { var empty = create("div", "w20-engagement-empty", emptyText); empty.setAttribute("role", "status"); fragment.appendChild(empty); }
    else items.forEach(function (item, index) { fragment.appendChild(card(item, index, showDemand)); });
    grid.insertBefore(fragment, anchor);
    return true;
  }

  function sortForUser(items) {
    var counts = activityCounts();
    return items.slice().sort(function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0); });
  }
  async function renderDiscoveryRoute(path) {
    if (["/surveys", "/latest", "/for-you", "/popular", "/most-requested"].indexOf(path) < 0) return;
    if (path === "/surveys") {
      renderSurface("Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª", "Ø´Ø§Ø±Ùƒ ÙÙŠ Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙØªÙˆØ­Ø© ÙˆØ³Ø§Ø¹Ø¯ Ù…ÙˆØ·Ù†ÙŠ Ø¹Ù„Ù‰ ØªÙˆØ«ÙŠÙ‚ Ø§Ù„Ø§Ø­ØªÙŠØ§Ø¬Ø§Øª ÙˆØ§Ù„Ø­Ø§Ù„Ø§Øª Ø¨ØµÙˆØ±Ø© Ø£Ø¯Ù‚.", [], "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª Ù…ÙØªÙˆØ­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.", false);
      return;
    }
    var payload = {};
    try { payload = await fetchJson(API_BASE + "/api/engagement/highlights"); } catch (_) {}
    if (path === "/latest") {
      var latest = safeArray(payload.latest);
      renderSurface("Ø¬Ø¯ÙŠØ¯", "Ø£Ø­Ø¯Ø« Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„Ù…ØªØ§Ø­Ø© ÙÙŠ Ù…ÙˆØ·Ù†ÙŠØŒ Ù…Ø±ØªØ¨Ø© Ø­Ø³Ø¨ ØªØ§Ø±ÙŠØ® Ø§Ù„Ù†Ø´Ø± Ø£Ùˆ Ø§Ù„Ø¥Ø¶Ø§ÙØ©.", latest, "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø¶Ø§ÙØ§Øª Ø­Ø¯ÙŠØ«Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.", false);
    } else if (path === "/for-you") {
      var recommended = safeArray(payload.recommended); if (!recommended.length) recommended = FALLBACK_RECOMMENDED;
      renderSurface("ÙŠÙ‡Ù…Ùƒ", "Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø­Ø§Ø¬Ø§Øª Ø§Ù„Ø¹Ø³ÙƒØ±ÙŠÙŠÙ† Ø§Ù„Ù…ØªÙ‚Ø§Ø¹Ø¯ÙŠÙ†ØŒ ÙˆØªØªØ­Ø³Ù† Ø¨Ø­Ø³Ø¨ Ø§Ù„ØµÙØ­Ø§Øª Ø§Ù„ØªÙŠ ØªÙØªØ­Ù‡Ø§ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ø¬Ù‡Ø§Ø².", sortForUser(recommended), "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.", false);
    } else {
      var requested = safeArray(payload.mostRequested);
      renderSurface("Ø§Ù„Ø£ÙƒØ«Ø± Ø·Ù„Ø¨Ø§Ù‹", "Ø§Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± ÙØªØ­Ø§Ù‹ ÙØ¹Ù„ÙŠØ§Ù‹ Ø®Ù„Ø§Ù„ Ø¢Ø®Ø± 30 ÙŠÙˆÙ…Ø§Ù‹. Ù„Ø§ Ù†Ø¹Ø±Ø¶ ØªØ±ØªÙŠØ¨Ø§Ù‹ Ù…ØµØ·Ù†Ø¹Ø§Ù‹ Ø¹Ù†Ø¯ ØºÙŠØ§Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª ÙƒØ§ÙÙŠØ©.", requested, "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ø·Ù„Ø¨ ÙƒØ§ÙÙŠØ© Ø¨Ø¹Ø¯. Ø³ÙŠØ¸Ù‡Ø± Ø§Ù„ØªØ±ØªÙŠØ¨ Ù‡Ù†Ø§ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ù…Ø¹ ØªØ²Ø§ÙŠØ¯ Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„ÙØ¹Ù„ÙŠ.", true);
    }
  }
  function installSurveyHomeTile() {
    if (currentPath() !== "/home") return;
    var grid = document.querySelector(".watany-v4-homepage__grid");
    if (!grid || grid.querySelector('[data-v4-home-icon="surveys"]')) return;
    var link = create("a", "watany-v4-launcher-card");
    link.href = "/surveys"; link.setAttribute("data-v4-home-icon", "surveys"); link.setAttribute("data-v4-icon-name", "forms"); link.setAttribute("aria-label", "Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª");
    var frame = create("span", "royal-gold-frame watany-v4-launcher-card__frame");
    var highlight = create("span", "royal-gold-frame__highlight"); highlight.setAttribute("aria-hidden", "true");
    var plate = create("span", "royal-gold-frame__plate");
    var img = create("img", "watany-v4-icon"); img.src = "/watany-v4/icons/forms.png"; img.alt = ""; img.setAttribute("aria-hidden", "true");
    plate.appendChild(img); frame.appendChild(highlight); frame.appendChild(plate); link.appendChild(frame);
    link.appendChild(create("span", "watany-v4-launcher-card__label", "Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª"));
    var popular = grid.querySelector('[data-v4-home-icon="popular"]');
    if (popular && popular.nextSibling) grid.insertBefore(link, popular.nextSibling); else grid.appendChild(link);
  }

  function bindHomepageDemandSignals() {
    var map = { salary: "salary", jobs: "jobs", marketplace: "marketplace", forms: "forms", procedures: "procedures", news: "news", community: "community" };
    document.querySelectorAll("[data-v4-home-icon]").forEach(function (node) {
      var id = node.getAttribute("data-v4-home-icon"); var key = map[id];
      if (!key || node.getAttribute("data-w20-demand-bound") === "true") return;
      node.setAttribute("data-w20-demand-bound", "true");
      node.addEventListener("click", function () { recordOpen({ id: key, href: "/" + key }); });
    });
  }
  function tickerNode(item) {
    var href = item && item.linkType === "route" && item.linkId ? item.linkId : (item && item.url ? item.url : "");
    var node = create(href ? "button" : "span", "ticker-item ticker-" + String((item && item.kind) || "tip"), (item && item.title) || "");
    if (href) {
      node.type = "button"; node.title = "Ø¹Ø±Ø¶ Ø§Ù„ØªÙØ§ØµÙŠÙ„";
      node.addEventListener("click", function () { window.location.assign(href); });
    }
    return node;
  }
  async function refreshTicker() {
    var track = document.querySelector(".watany-recovery-ticker .ticker-track");
    if (!track) return;
    if (track.closest("#root")) return;
    try {
      var payload = await fetchJson(API_BASE + "/api/ticker");
      var items = safeArray(payload.items).slice(0, 20);
      if (!items.length) return;
      var fragment = document.createDocumentFragment();
      [0, 1].forEach(function () { items.forEach(function (item) { fragment.appendChild(tickerNode(item)); }); });
      track.textContent = ""; track.appendChild(fragment); track.setAttribute("data-w20-ticker-source", "live-api");
    } catch (_) {}
  }
  function standaloneLink(href, label, iconSrc) {
    var link = create("a", "w20-shell-link"); link.href = href;
    if (iconSrc) { var img = create("img", "w20-shell-icon"); img.src = iconSrc; img.alt = ""; img.setAttribute("aria-hidden", "true"); link.appendChild(img); }
    link.appendChild(create("span", "", label)); return link;
  }
  function closeStandaloneDrawer() {
    var drawer = document.getElementById("watany-main-drawer"); var backdrop = document.querySelector(".w20-shell-backdrop"); var button = document.querySelector(".w20-shell-menu");
    if (drawer) { drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); }
    if (backdrop) backdrop.classList.remove("is-open");
    if (button) button.setAttribute("aria-expanded", "false");
  }
  function ensureCustomsOption() {
    document.querySelectorAll("select").forEach(function (select) {
      var texts = Array.prototype.map.call(select.options, function (option) { return option.textContent.trim(); });
      if (texts.indexOf("Ø§Ù„Ø¬ÙŠØ´ Ø§Ù„Ù„Ø¨Ù†Ø§Ù†ÙŠ") < 0 || texts.indexOf("Ø§Ù„Ø¬Ù…Ø§Ø±Ùƒ") >= 0) return;
      var option = document.createElement("option"); option.value = "Ø§Ù„Ø¬Ù…Ø§Ø±Ùƒ"; option.textContent = "Ø§Ù„Ø¬Ù…Ø§Ø±Ùƒ"; select.appendChild(option);
    });
  }
  function installStandaloneShell() {
    if (currentPath() !== "/veterans-2019" || document.querySelector(".w20-standalone-topbar")) { ensureCustomsOption(); return; }
    document.body.classList.add("w20-standalone-shell");
    var top = create("header", "w20-standalone-topbar");
    var menu = create("button", "w20-shell-menu", "â˜°"); menu.type = "button"; menu.setAttribute("aria-label", "ÙØªØ­ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©"); menu.setAttribute("aria-controls", "watany-main-drawer"); menu.setAttribute("aria-expanded", "false");
    var brand = standaloneLink("/home", "Ù…ÙˆØ·Ù†ÙŠ", "/logo.png"); brand.classList.add("w20-shell-brand");
    var login = standaloneLink("/login", "Ø§Ù„Ø¯Ø®ÙˆÙ„", "/watany-v4/icons/login.png"); login.classList.add("w20-shell-login");
    top.appendChild(menu); top.appendChild(brand); top.appendChild(login); document.body.insertBefore(top, document.body.firstChild);
    var backdrop = create("div", "w20-shell-backdrop"); backdrop.setAttribute("aria-hidden", "true"); document.body.appendChild(backdrop);
    var drawer = create("nav", "w20-shell-drawer"); drawer.id = "watany-main-drawer"; drawer.setAttribute("aria-label", "Ù‚Ø§Ø¦Ù…Ø© Ù…ÙˆØ·Ù†ÙŠ"); drawer.setAttribute("aria-hidden", "true");
    var drawerTitle = create("div", "w20-shell-drawer-head"); drawerTitle.appendChild(create("strong", "", "ØªØµÙØ­ Ù…ÙˆØ·Ù†ÙŠ"));
    var close = create("button", "w20-shell-close", "Ã—"); close.type = "button"; close.setAttribute("aria-label", "Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©"); drawerTitle.appendChild(close); drawer.appendChild(drawerTitle);
    var drawerLinks = [
      ["/home", "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"], ["/surveys", "Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª"], ["/salary", "Ø§Ù„Ù…Ø¹Ø§Ø´"], ["/procedures", "Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª"],
      ["/jobs", "Ø§Ù„ÙˆØ¸Ø§Ø¦Ù"], ["/marketplace", "Ø§Ù„Ø³ÙˆÙ‚"], ["/forms", "Ø§Ù„Ù†Ù…Ø§Ø°Ø¬"], ["/news", "Ø§Ù„Ø£Ø®Ø¨Ø§Ø±"], ["/community", "Ù…Ø¬ØªÙ…Ø¹ÙŠ"]
    ];
    var drawerList = create("div", "w20-shell-drawer-list");
    drawerLinks.forEach(function (row) { drawerList.appendChild(standaloneLink(row[0], row[1], "")); });
    drawer.appendChild(drawerList); document.body.appendChild(drawer);
    var bottom = create("nav", "w20-standalone-bottom", ""); bottom.setAttribute("aria-label", "Ø§Ù„ØªÙ†Ù‚Ù„ Ø§Ù„Ø³ÙÙ„ÙŠ");
    bottom.appendChild(standaloneLink("/home", "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©", "/watany-v4/icons/home-sign.png"));
    bottom.appendChild(standaloneLink("/profile", "Ù…Ù„ÙÙŠ", "/watany-v4/icons/profile.png"));
    bottom.appendChild(standaloneLink("/chat", "Ù…ÙˆØ·Ù†ÙŠ", "/logo.png"));
    bottom.appendChild(standaloneLink("/login", "Ø§Ù„Ø¯Ø®ÙˆÙ„", "/watany-v4/icons/login.png"));
    bottom.appendChild(standaloneLink("/community", "Ù…Ø¬ØªÙ…Ø¹ÙŠ", "/watany-v4/icons/community.png"));
    document.body.appendChild(bottom);
    function openDrawer() { drawer.classList.add("is-open"); backdrop.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); menu.setAttribute("aria-expanded", "true"); }
    menu.addEventListener("click", function () { if (drawer.classList.contains("is-open")) closeStandaloneDrawer(); else openDrawer(); });
    close.addEventListener("click", closeStandaloneDrawer); backdrop.addEventListener("click", closeStandaloneDrawer);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeStandaloneDrawer(); });
    ensureCustomsOption();
  }

  async function boot() {
    var path = currentPath();
    document.documentElement.setAttribute("data-w20-engagement-runtime", VERSION);
    if (path === "/veterans-2019") { installStandaloneShell(); return; }
    installSurveyHomeTile(); bindHomepageDemandSignals();
    await Promise.all([renderDiscoveryRoute(path), refreshTicker()]);
  }
  function scheduleBoot() { window.setTimeout(function () { boot().catch(function () {}); }, 80); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBoot, { once: true }); else scheduleBoot();
  window.setTimeout(scheduleBoot, 850);
  window.addEventListener("popstate", scheduleBoot);
})();
