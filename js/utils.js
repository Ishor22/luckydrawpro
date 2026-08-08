// Shared helpers used by every page.
window.LD = (function () {

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDateTime(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    var datePart = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    var timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return datePart + ", " + timePart;
  }

  function formatDate(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function secureRandomIndex(maxExclusive) {
    if (maxExclusive <= 0) return -1;
    var array = new Uint32Array(1);
    var limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
    var value;
    do {
      window.crypto.getRandomValues(array);
      value = array[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  // Simple toast notifications. Requires a <div id="toastHost"></div> on the page.
  function toast(message, type) {
    var host = document.getElementById("toastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "toastHost";
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "info");
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 250);
    }, 4200);
  }

  function setBusy(btn, busy, busyLabel) {
    if (!btn) return;
    if (busy) {
      btn.dataset.originalLabel = btn.dataset.originalLabel || btn.textContent;
      btn.disabled = true;
      btn.textContent = busyLabel || "Working…";
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalLabel || btn.textContent;
    }
  }

  function friendlyError(err) {
    if (!err) return "Something went wrong. Please try again.";
    var msg = (err.message || String(err)).toLowerCase();
    if (msg.indexOf("invalid login credentials") !== -1) return "Incorrect email or password.";
    if (msg.indexOf("user already registered") !== -1) return "An account with that email already exists.";
    if (msg.indexOf("email not confirmed") !== -1) return "Please confirm your email before logging in.";
    if (msg.indexOf("network") !== -1 || msg.indexOf("fetch") !== -1) return "No internet connection. Please check your connection and try again.";
    if (msg.indexOf("jwt") !== -1 || msg.indexOf("session") !== -1) return "Your session has expired. Please log in again.";
    if (msg.indexOf("row-level security") !== -1 || msg.indexOf("permission denied") !== -1) return "You don't have permission to do that.";
    if (msg.indexOf("password") !== -1 && msg.indexOf("6 characters") !== -1) return "Password must be at least 6 characters.";
    return "Something went wrong: " + (err.message || "please try again.");
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function downloadCsv(filename, rows) {
    if (!rows || rows.length === 0) {
      toast("Nothing to export yet.", "info");
      return;
    }
    var headers = Object.keys(rows[0]);
    var lines = [headers.join(",")];
    rows.forEach(function (row) {
      var line = headers.map(function (h) {
        var val = row[h] == null ? "" : String(row[h]);
        val = val.replace(/"/g, '""');
        if (val.search(/[",\n]/) !== -1) val = '"' + val + '"';
        return val;
      }).join(",");
      lines.push(line);
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("luckydraw_theme", theme); } catch (e) {}
  }

  function initThemeToggle(buttonEl) {
    var saved = "dark";
    try { saved = localStorage.getItem("luckydraw_theme") || "dark"; } catch (e) {}
    applyTheme(saved);
    if (buttonEl) {
      buttonEl.textContent = saved === "dark" ? "🌙" : "☀️";
      buttonEl.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        var next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        buttonEl.textContent = next === "dark" ? "🌙" : "☀️";
      });
    }
  }

  async function logActivity(userId, action, description) {
    try {
      await window.sb.from("activity_logs").insert({
        user_id: userId,
        action: action,
        description: description || ""
      });
    } catch (e) {
      // Activity logging should never block the main action.
      console.warn("Could not write activity log:", e);
    }
  }

  return {
    escapeHtml: escapeHtml,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    secureRandomIndex: secureRandomIndex,
    toast: toast,
    setBusy: setBusy,
    friendlyError: friendlyError,
    qs: qs,
    downloadCsv: downloadCsv,
    applyTheme: applyTheme,
    initThemeToggle: initThemeToggle,
    logActivity: logActivity
  };
})();
