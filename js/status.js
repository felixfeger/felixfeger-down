// js/status.js
//
// Standalone status feed. It shows incidents and maintenance from two places:
//
//   1. A live feed from your status Worker (set feedUrl in SETTINGS). This is
//      where the dashboard and Better Stack monitoring show up.
//   2. The two hand-written lists in the DATA section below. Use these for
//      anything you want to pin without the Worker, or as a backup.
//
// If both contain the same id, the live feed wins.
//
// To show the feed on any page:
//
//   <div data-status-feed></div>
//   <script src="js/status.js"></script>
//
// Optional attributes on that div:
//
//   data-show="all"          everything (default)
//   data-show="incidents"    only incidents
//   data-show="maintenance"  only maintenance
//   data-history="false"     hide the "Past events" section
//   data-service="tv"        only show things for one service (by id), plus
//                            general notices that aren't tied to a service
//   data-empty-incidents="..."    text shown when there are no incidents
//   data-empty-maintenance="..."  text shown when there is no maintenance
//
// When there is nothing to show, the feed says we aren't aware of any
// maintenance or outages and asks people to contact us. It never says
// anything is down unless you've added it below.
//
// Pages can also read the current state through window.SiteStatus (see the
// bottom of this file). maintenance.html and outage.html do this to fill in
// their headline, status pill and timeline.
//
// Maintenance status is worked out from the start and end times, so a
// window moves from Scheduled to In progress to Completed on its own.
// Incidents are updated by hand (see the template below).


(function () {
  "use strict";

  // =====================================================================
  //  SETTINGS
  // =====================================================================

  var SETTINGS = {
    // Times in the feed are shown in this time zone.
    timeZone: "America/Los_Angeles",

    // Show resolved incidents and completed maintenance for a while.
    showHistory: true,
    historyDays: 30,

    // Shown in the "nothing posted" message so people know who to contact.
    contactEmail: "hello@felixfeger.com",

    // Address of your status Worker's public feed, for example
    // "https://status-api.felixfeger.com/api/status". Leave it empty to use
    // only the hand-written lists below.
    feedUrl: "https://status-api.felixfeger.com/api/status",

    // How long to wait for the feed before showing what we have.
    feedTimeoutMs: 4000
  };


  // =====================================================================
  //  DATA
  // =====================================================================

  // ---- Incidents ------------------------------------------------------
  //
  // Copy the template, fill it in, and add it to the list (newest first
  // is easiest, but the order doesn't matter).
  //
  //   {
  //     id: "2026-12-01-login",              // anything unique
  //     title: "Sign-in is unavailable",
  //     status: "investigating",             // investigating | identified
  //                                          //   | monitoring | resolved
  //     started: "2026-12-01T09:15:00-08:00",
  //     resolved: "2026-12-01T11:40:00-08:00",   // only when resolved
  //     affected: "Sign-in",                 // optional
  //     description: "Some visitors can't sign in.",   // optional
  //     updates: [                           // optional, any order
  //       { time: "2026-12-01T09:40:00-08:00",
  //         status: "identified",
  //         message: "We found the cause and are working on a fix." }
  //     ]
  //   }
  //
  // Times are written like 2026-12-01T09:15:00-08:00
  // (date, T, 24-hour time, then the offset: -08:00 for PST, -07:00 for PDT).
  //
  // If you leave out "status", the status of the latest update is used.
  // To resolve an incident, set status to "resolved" and add "resolved".

  var INCIDENTS = [
    // (none)
  ];


  // ---- Maintenance ----------------------------------------------------
  //
  //   {
  //     id: "2026-12-05-update",
  //     title: "Website updates",
  //     start: "2026-12-05T22:00:00-08:00",
  //     end:   "2026-12-06T00:00:00-08:00",
  //     affected: "felixfeger.com",          // optional
  //     description: "The site will be offline briefly."   // optional
  //   }
  //
  // Optional: set status to "scheduled", "in-progress" or "completed" to
  // override the automatic status (for example, to finish a window early).

  var MAINTENANCES = [
    // (none)
  ];


  // =====================================================================
  //  LABELS
  // =====================================================================

  var LABELS = {
    investigating: "Investigating",
    identified: "Identified",
    monitoring: "Monitoring",
    resolved: "Resolved",
    scheduled: "Scheduled",
    "in-progress": "In progress",
    completed: "Completed"
  };


  // =====================================================================
  //  EVERYTHING BELOW RENDERS THE FEED. NO NEED TO EDIT.
  // =====================================================================

  var DAY = 24 * 60 * 60 * 1000;

  // What the live feed last returned. Merged with the hand-written lists.
  var live = { incidents: [], maintenances: [], services: [] };

  function serviceName(id) {
    for (var i = 0; i < live.services.length; i++) {
      if (live.services[i].id === id) return live.services[i].name;
    }
    return id;
  }

  // An item matches a service if it names it, or isn't tied to any service.
  function matchesService(item, service) {
    if (!service) return true;
    var list = item && item.services;
    if (!list || !list.length) return true;
    return list.indexOf(service) !== -1;
  }

  // "Affected" text: what was written by hand, otherwise the service names.
  function affectedText(item) {
    if (item.affected) return item.affected;
    return (item.services || []).map(serviceName).join(", ");
  }

  function merge(local, remote) {
    var seen = {};
    var out = [];
    remote.forEach(function (item) {
      if (item && item.id) seen[item.id] = true;
      out.push(item);
    });
    local.forEach(function (item) {
      if (!(item && item.id && seen[item.id])) out.push(item);
    });
    return out;
  }

  function allIncidents() { return merge(INCIDENTS, live.incidents); }
  function allMaintenances() { return merge(MAINTENANCES, live.maintenances); }

  // ---- Styles (injected once; uses the site's colors when present) ------

  var CSS = [
    ".sf { max-width: 720px; margin: 0 auto; font-family: var(--font-body, 'Inter', sans-serif); color: var(--ink, #3A362C); }",
    ".sf *, .sf *::before, .sf *::after { box-sizing: border-box; }",

    ".sf-banner { display: flex; align-items: center; gap: 14px; border: 1px solid var(--line, #D9D0BA); background: var(--bg, #F5F1E8); padding: 18px 22px; margin-bottom: 36px; }",
    ".sf-banner h2 { font-family: var(--font-display, 'Quicksand', sans-serif); font-size: 1.15rem; margin: 0; line-height: 1.2; color: var(--ink, #3A362C); }",
    ".sf-banner p { margin: 2px 0 0; font-size: 0.92rem; color: var(--ink-soft, #6B6355); max-width: none; }",

    ".sf-dot { flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--teal, #3E6B6B); }",
    ".sf-dot[data-tone='warn'] { background: var(--amber, #C9932E); animation: sf-pulse 2s ease-in-out infinite; }",
    ".sf-dot[data-tone='info'] { background: var(--amber, #C9932E); }",
    ".sf-dot[data-tone='quiet'] { background: var(--line, #D9D0BA); border: 2px solid var(--ink-soft, #6B6355); }",
    "@keyframes sf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }",
    "@media (prefers-reduced-motion: reduce) { .sf-dot[data-tone='warn'] { animation: none; } }",

    ".sf-section { margin-bottom: 36px; }",
    ".sf-heading { font-family: var(--font-display, 'Quicksand', sans-serif); font-weight: 700; font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-soft, #6B6355); margin: 0 0 12px; }",

    ".sf-empty { border: 1px dashed var(--line, #D9D0BA); padding: 18px 22px; color: var(--ink-soft, #6B6355); font-size: 0.95rem; margin: 0; max-width: none; }",

    ".sf-card { border: 1px solid var(--line, #D9D0BA); background: var(--bg, #F5F1E8); padding: 20px 22px; margin-bottom: 14px; }",
    ".sf-card[data-tone='warn'] { border-left: 4px solid var(--amber, #C9932E); }",
    ".sf-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }",
    ".sf-card h3 { font-family: var(--font-display, 'Quicksand', sans-serif); font-size: 1.1rem; margin: 0; line-height: 1.25; color: var(--ink, #3A362C); }",

    ".sf-pill { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line, #D9D0BA); background: var(--bg-raised, #ECE5D3); border-radius: 999px; padding: 2px 12px; font-family: var(--font-display, 'Quicksand', sans-serif); font-weight: 600; font-size: 0.8rem; white-space: nowrap; }",
    ".sf-pill .sf-dot { width: 8px; height: 8px; animation: none; border-width: 1.5px; }",

    ".sf-meta { margin: 8px 0 0; font-size: 0.88rem; color: var(--ink-soft, #6B6355); max-width: none; }",
    ".sf-desc { margin: 10px 0 0; font-size: 0.95rem; color: var(--ink, #3A362C); max-width: 62ch; }",

    ".sf-updates { list-style: none; margin: 16px 0 0; padding: 14px 0 0; border-top: 1px solid var(--line, #D9D0BA); }",
    ".sf-update { margin: 0 0 12px; font-size: 0.92rem; }",
    ".sf-update:last-child { margin-bottom: 0; }",
    ".sf-update strong { font-family: var(--font-display, 'Quicksand', sans-serif); }",
    ".sf-update time { display: block; font-size: 0.82rem; color: var(--ink-soft, #6B6355); }",
    ".sf-update p { margin: 2px 0 0; color: var(--ink, #3A362C); max-width: 62ch; }"
  ].join("\n");

  function injectStyles() {
    if (document.getElementById("sf-styles")) return;
    var style = document.createElement("style");
    style.id = "sf-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }


  // ---- Small helpers --------------------------------------------------

  function h(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function time(value) {
    var t = new Date(value).getTime();
    return isNaN(t) ? null : t;
  }

  function fmtDateTime(value) {
    var t = time(value);
    if (t === null) return String(value || "");
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZoneName: "short",
        timeZone: SETTINGS.timeZone
      }).format(new Date(t));
    } catch (e) {
      return new Date(t).toLocaleString();
    }
  }

  function fmtTimeOnly(value) {
    var t = time(value);
    if (t === null) return String(value || "");
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric", minute: "2-digit", timeZoneName: "short",
        timeZone: SETTINGS.timeZone
      }).format(new Date(t));
    } catch (e) {
      return new Date(t).toLocaleTimeString();
    }
  }

  function dayKey(value) {
    var t = time(value);
    if (t === null) return "";
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric", month: "numeric", day: "numeric",
        timeZone: SETTINGS.timeZone
      }).format(new Date(t));
    } catch (e) {
      return new Date(t).toDateString();
    }
  }

  function fmtRange(start, end) {
    if (!end) return fmtDateTime(start);
    if (dayKey(start) === dayKey(end)) {
      return fmtDateTime(start) + " to " + fmtTimeOnly(end);
    }
    return fmtDateTime(start) + " to " + fmtDateTime(end);
  }


  // ---- Working out status ---------------------------------------------

  function latestUpdate(incident) {
    var list = incident.updates || [];
    var best = null;
    for (var i = 0; i < list.length; i++) {
      if (!best || (time(list[i].time) || 0) > (time(best.time) || 0)) best = list[i];
    }
    return best;
  }

  function incidentStatus(incident) {
    if (incident.status) return incident.status;
    var last = latestUpdate(incident);
    return (last && last.status) || "investigating";
  }

  function incidentEnd(incident) {
    if (incident.resolved) return time(incident.resolved);
    var last = latestUpdate(incident);
    return (last && time(last.time)) || time(incident.started) || 0;
  }

  function maintenanceStatus(m, now) {
    if (m.status) return m.status;
    var start = time(m.start);
    var end = time(m.end);
    if (start !== null && now < start) return "scheduled";
    if (end !== null && now > end) return "completed";
    return start === null ? "scheduled" : "in-progress";
  }

  function toneFor(status) {
    if (status === "resolved" || status === "completed") return "ok";
    if (status === "scheduled") return "quiet";
    if (status === "in-progress") return "info";
    return "warn";
  }


  // ---- Building the pieces --------------------------------------------

  function pill(status) {
    var p = h("span", "sf-pill");
    var d = h("span", "sf-dot");
    d.setAttribute("data-tone", toneFor(status));
    p.appendChild(d);
    p.appendChild(document.createTextNode(LABELS[status] || status));
    return p;
  }

  function incidentCard(incident, status) {
    var card = h("article", "sf-card");
    card.setAttribute("data-tone", toneFor(status) === "warn" ? "warn" : "");

    var top = h("div", "sf-card-top");
    top.appendChild(h("h3", "", incident.title || "Incident"));
    top.appendChild(pill(status));
    card.appendChild(top);

    var meta = "Started " + fmtDateTime(incident.started);
    if (status === "resolved" && incidentEnd(incident)) {
      meta += " \u00B7 Resolved " + fmtDateTime(new Date(incidentEnd(incident)).toISOString());
    }
    if (affectedText(incident)) meta += " \u00B7 Affected: " + affectedText(incident);
    card.appendChild(h("p", "sf-meta", meta));

    if (incident.description) card.appendChild(h("p", "sf-desc", incident.description));

    var updates = (incident.updates || []).slice().sort(function (a, b) {
      return (time(b.time) || 0) - (time(a.time) || 0);
    });
    if (updates.length) {
      var list = h("ol", "sf-updates");
      updates.forEach(function (u) {
        var li = h("li", "sf-update");
        li.appendChild(h("strong", "", LABELS[u.status] || u.status || "Update"));
        li.appendChild(h("time", "", fmtDateTime(u.time)));
        if (u.message) li.appendChild(h("p", "", u.message));
        list.appendChild(li);
      });
      card.appendChild(list);
    }
    return card;
  }

  function maintenanceCard(m, status) {
    var card = h("article", "sf-card");
    card.setAttribute("data-tone", status === "in-progress" ? "warn" : "");

    var top = h("div", "sf-card-top");
    top.appendChild(h("h3", "", m.title || "Maintenance"));
    top.appendChild(pill(status));
    card.appendChild(top);

    var meta = fmtRange(m.start, m.end);
    if (affectedText(m)) meta += " \u00B7 Affected: " + affectedText(m);
    card.appendChild(h("p", "sf-meta", meta));

    if (m.description) card.appendChild(h("p", "sf-desc", m.description));
    return card;
  }

  function section(title) {
    var s = h("section", "sf-section");
    s.appendChild(h("h2", "sf-heading", title));
    return s;
  }

  function empty(text) {
    return h("p", "sf-empty", text);
  }

  function contactLine(lead) {
    var p = h("p");
    p.appendChild(document.createTextNode(lead));
    var a = h("a", "", "contact us");
    a.href = "mailto:" + SETTINGS.contactEmail;
    a.style.color = "inherit";
    a.style.textDecoration = "underline";
    p.appendChild(a);
    p.appendChild(document.createTextNode(" with the details and we'll investigate."));
    return p;
  }

  function banner(activeIncidents, runningMaint, upcomingMaint) {
    var box = h("div", "sf-banner");
    var dot = h("span", "sf-dot");
    var text = h("div");
    var title, sub;

    if (activeIncidents.length) {
      dot.setAttribute("data-tone", "warn");
      title = activeIncidents.length === 1 ? "Active incident" : activeIncidents.length + " active incidents";
      sub = h("p", "", "We're working to resolve it. Details below.");
    } else if (runningMaint.length) {
      dot.setAttribute("data-tone", "info");
      title = "Maintenance in progress";
      sub = h("p", "", "Some things may be unavailable for a short time.");
    } else if (upcomingMaint.length) {
      title = "No known outages";
      sub = h("p", "", "Maintenance is scheduled. Details below.");
    } else if (feedState === "unavailable") {
      dot.setAttribute("data-tone", "info");
      title = "Status unavailable";
      sub = contactLine("We couldn't load live status just now. If something isn't working for you, ");
    } else {
      title = "No known issues";
      sub = contactLine("We aren't aware of any maintenance or outages. If something isn't working for you, ");
    }

    text.appendChild(h("h2", "", title));
    text.appendChild(sub);
    box.appendChild(dot);
    box.appendChild(text);
    return box;
  }


  // ---- Putting it together --------------------------------------------

  function render(container) {
    var now = Date.now();
    var show = (container.getAttribute("data-show") || "all").toLowerCase();
    var service = container.getAttribute("data-service") || "";
    var wantHistory = container.getAttribute("data-history") !== "false" && SETTINGS.showHistory;
    var wantIncidents = show === "all" || show === "incidents";
    var wantMaint = show === "all" || show === "maintenance";

    // Sort everything into active and past.
    var activeIncidents = [], pastIncidents = [];
    allIncidents().forEach(function (i) {
      if (!matchesService(i, service)) return;
      var s = incidentStatus(i);
      (s === "resolved" ? pastIncidents : activeIncidents).push({ item: i, status: s });
    });
    activeIncidents.sort(function (a, b) {
      return (time(b.item.started) || 0) - (time(a.item.started) || 0);
    });

    var upcomingMaint = [], runningMaint = [], pastMaint = [];
    allMaintenances().forEach(function (m) {
      if (!matchesService(m, service)) return;
      var s = maintenanceStatus(m, now);
      var entry = { item: m, status: s };
      if (s === "completed") pastMaint.push(entry);
      else if (s === "in-progress") runningMaint.push(entry);
      else upcomingMaint.push(entry);
    });
    upcomingMaint.sort(function (a, b) {
      return (time(a.item.start) || 0) - (time(b.item.start) || 0);
    });

    var cutoff = now - SETTINGS.historyDays * DAY;
    var history = [];
    pastIncidents.forEach(function (e) {
      if (incidentEnd(e.item) >= cutoff) history.push({ kind: "incident", when: incidentEnd(e.item), entry: e });
    });
    pastMaint.forEach(function (e) {
      var end = time(e.item.end) || time(e.item.start) || 0;
      if (end >= cutoff) history.push({ kind: "maintenance", when: end, entry: e });
    });
    history.sort(function (a, b) { return b.when - a.when; });

    // Build the feed.
    var root = h("div", "sf");

    if (show === "all") {
      root.appendChild(banner(
        activeIncidents, runningMaint, upcomingMaint
      ));
    }

    if (wantIncidents) {
      var incSection = section("Incidents");
      if (activeIncidents.length) {
        activeIncidents.forEach(function (e) {
          incSection.appendChild(incidentCard(e.item, e.status));
        });
      } else {
        incSection.appendChild(empty(feedState === "unavailable" ? "We couldn't load live status just now." : (container.getAttribute("data-empty-incidents") || "We aren't aware of any outages right now.")));
      }
      root.appendChild(incSection);
    }

    if (wantMaint) {
      var mSection = section("Maintenance");
      var activeMaint = runningMaint.concat(upcomingMaint);
      if (activeMaint.length) {
        activeMaint.forEach(function (e) {
          mSection.appendChild(maintenanceCard(e.item, e.status));
        });
      } else {
        mSection.appendChild(empty(feedState === "unavailable" ? "We couldn't load live status just now." : (container.getAttribute("data-empty-maintenance") || "We aren't aware of any maintenance right now.")));
      }
      root.appendChild(mSection);
    }

    if (wantHistory) {
      var shown = history.filter(function (e) {
        return (e.kind === "incident" && wantIncidents) || (e.kind === "maintenance" && wantMaint);
      });
      var hSection = section("Past events (last " + SETTINGS.historyDays + " days)");
      if (shown.length) {
        shown.forEach(function (e) {
          hSection.appendChild(
            e.kind === "incident"
              ? incidentCard(e.entry.item, e.entry.status)
              : maintenanceCard(e.entry.item, e.entry.status)
          );
        });
      } else {
        hSection.appendChild(empty("No past incidents or maintenance in the last " + SETTINGS.historyDays + " days."));
      }
      root.appendChild(hSection);
    }

    container.textContent = "";
    container.appendChild(root);
  }


  // ---- Read-only API for other pages ----------------------------------
  //
  //   SiteStatus.activeIncident(svc)      newest unresolved incident, or null
  //   SiteStatus.currentMaintenance(svc)  maintenance in progress, otherwise the
  //                                       next scheduled one, or null
  //                                       (svc is an optional service id)
  //   SiteStatus.serviceName(id)          e.g. "tv" -> "Felix TV"
  //   SiteStatus.subscribe(fn)         runs fn now and again every minute
  //   SiteStatus.labels                the status names shown on the pages

  var listeners = [];

  // "off" (no feedUrl), "ok", "cached" (feed down, using a saved copy) or
  // "unavailable" (feed down and nothing saved).
  var feedState = SETTINGS.feedUrl ? "unavailable" : "off";
  var ready = !SETTINGS.feedUrl;

  function activeIncident(service) {
    var open = [];
    allIncidents().forEach(function (i) {
      if (!matchesService(i, service)) return;
      var s = incidentStatus(i);
      if (s !== "resolved") open.push({ item: i, status: s });
    });
    if (!open.length) return null;
    open.sort(function (a, b) {
      return (time(b.item.started) || 0) - (time(a.item.started) || 0);
    });
    var top = open[0];
    var last = latestUpdate(top.item);
    return {
      item: top.item,
      status: top.status,
      label: LABELS[top.status] || top.status,
      startedText: fmtDateTime(top.item.started),
      latest: last,
      latestTimeText: last ? fmtDateTime(last.time) : ""
    };
  }

  function currentMaintenance(service) {
    var now = Date.now();
    var running = [], upcoming = [];
    allMaintenances().forEach(function (m) {
      if (!matchesService(m, service)) return;
      var s = maintenanceStatus(m, now);
      if (s === "in-progress") running.push({ item: m, status: s });
      else if (s === "scheduled") upcoming.push({ item: m, status: s });
    });
    function byStart(a, b) {
      return (time(a.item.start) || 0) - (time(b.item.start) || 0);
    }
    running.sort(byStart);
    upcoming.sort(byStart);
    var pick = running[0] || upcoming[0];
    if (!pick) return null;
    return {
      item: pick.item,
      status: pick.status,
      label: LABELS[pick.status] || pick.status,
      rangeText: fmtRange(pick.item.start, pick.item.end),
      endText: pick.item.end ? fmtDateTime(pick.item.end) : ""
    };
  }

  function notify() {
    if (!ready) return;
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* a page's own code shouldn't break the feed */ }
    });
  }

  window.SiteStatus = {
    labels: LABELS,
    serviceName: serviceName,
    activeIncident: activeIncident,
    currentMaintenance: currentMaintenance,
    feedState: function () { return feedState; },
    subscribe: function (fn) {
      listeners.push(fn);
      // Wait for the first look at the feed so a page doesn't flash
      // "no known issues" while an incident is still loading.
      if (ready) {
        try { fn(); } catch (e) { /* see notify() */ }
      }
    }
  };

  // ---- Live feed ------------------------------------------------------

  var CACHE_KEY = "siteStatusFeed";

  function loadSaved() {
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (saved && Date.now() - saved.savedAt < DAY) return saved.feed;
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function save(feed) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), feed: feed }));
    } catch (e) { /* storage unavailable */ }
  }

  function applyFeed(feed) {
    live.incidents = feed && Array.isArray(feed.incidents) ? feed.incidents : [];
    live.maintenances = feed && Array.isArray(feed.maintenances) ? feed.maintenances : [];
    live.services = feed && Array.isArray(feed.services) ? feed.services : [];
  }

  function fetchFeed() {
    if (!SETTINGS.feedUrl || typeof fetch !== "function") return Promise.resolve();

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, SETTINGS.feedTimeoutMs) : null;

    return fetch(SETTINGS.feedUrl, { cache: "no-store", signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("feed " + res.status);
        return res.json();
      })
      .then(function (feed) {
        applyFeed(feed);
        save(feed);
        feedState = "ok";
      })
      .catch(function () {
        // Fall back to the last copy we saw (up to a day old) so a hiccup
        // doesn't hide an incident that was already showing.
        var saved = loadSaved();
        if (saved) {
          applyFeed(saved);
          feedState = "cached";
        } else {
          applyFeed(null);
          feedState = "unavailable";
        }
      })
      .then(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function renderAll() {
    var containers = document.querySelectorAll("[data-status-feed]");
    for (var i = 0; i < containers.length; i++) render(containers[i]);
    notify();
  }

  function start() {
    injectStyles();

    if (!SETTINGS.feedUrl) {
      renderAll();
      // Re-check once a minute so maintenance windows change status on their own.
      setInterval(renderAll, 60 * 1000);
      return;
    }

    fetchFeed().then(function () {
      ready = true;
      renderAll();
    });
    setInterval(function () {
      fetchFeed().then(renderAll);
    }, 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();