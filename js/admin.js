(async function () {
  "use strict";

  var ctx = await LDAuth.requireAdmin();
  if (!ctx) return;
  var user = ctx.session.user;
  LDAuth.paintHeader(ctx.profile);

  document.getElementById("adminLoading").style.display = "none";
  document.getElementById("adminContent").style.display = "flex";

  /* ---------------- Sidebar nav ---------------- */
  var navButtons = document.querySelectorAll(".admin-nav-btn");
  var views = document.querySelectorAll(".admin-view");
  navButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-view");
      navButtons.forEach(function (b) { b.classList.toggle("active", b === btn); });
      views.forEach(function (v) { v.classList.toggle("active", v.id === "view-" + target); });
      loadView(target);
    });
  });

  var loadedOnce = {};

  function loadView(name) {
    if (name === "overview") loadOverview();
    if (name === "users") loadUsers();
    if (name === "draws") loadDraws();
    if (name === "participants") loadParticipants();
    if (name === "winners") loadWinners();
    if (name === "logs") loadLogs();
  }

  /* ---------------- Overview ---------------- */
  async function loadOverview() {
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    var [{ count: userCount }, { count: drawCount }, { count: participantCount }, { count: winnerCount }, { count: drawsToday }, { count: usersToday }] = await Promise.all([
      window.sb.from("profiles").select("*", { count: "exact", head: true }),
      window.sb.from("draws").select("*", { count: "exact", head: true }),
      window.sb.from("participants").select("*", { count: "exact", head: true }),
      window.sb.from("draw_results").select("*", { count: "exact", head: true }),
      window.sb.from("draws").select("*", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
      window.sb.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", todayStart.toISOString())
    ]);

    document.getElementById("ovUsers").textContent = userCount || 0;
    document.getElementById("ovDraws").textContent = drawCount || 0;
    document.getElementById("ovParticipants").textContent = participantCount || 0;
    document.getElementById("ovWinners").textContent = winnerCount || 0;
    document.getElementById("ovDrawsToday").textContent = drawsToday || 0;
    document.getElementById("ovUsersToday").textContent = usersToday || 0;
  }

  /* ---------------- Users ---------------- */
  var allUsers = [];
  async function loadUsers() {
    var { data, error } = await window.sb.from("profiles").select("*, draws(count)").order("created_at", { ascending: false });
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    allUsers = data || [];
    renderUsers();
  }

  function renderUsers() {
    var search = (document.getElementById("userSearch").value || "").toLowerCase();
    var roleFilter = document.getElementById("userRoleFilter").value;
    var rows = allUsers.filter(function (u) {
      var matchesSearch = !search || (u.full_name || "").toLowerCase().indexOf(search) !== -1 || (u.email || "").toLowerCase().indexOf(search) !== -1;
      var matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
    var tbody = document.getElementById("usersBody");
    tbody.innerHTML = "";
    if (rows.length === 0) { document.getElementById("usersEmpty").style.display = "block"; return; }
    document.getElementById("usersEmpty").style.display = "none";

    rows.forEach(function (u) {
      var drawCount = u.draws && u.draws[0] ? u.draws[0].count : 0;
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td data-label="Name">' + LD.escapeHtml(u.full_name || "—") + '</td>' +
        '<td data-label="Email">' + LD.escapeHtml(u.email) + '</td>' +
        '<td data-label="Role"><span class="badge ' + (u.role === "admin" ? "badge-role-admin" : "") + '">' + u.role + '</span></td>' +
        '<td data-label="Joined">' + LD.formatDate(u.created_at) + '</td>' +
        '<td data-label="Draws">' + drawCount + '</td>' +
        '<td data-label="Status"><span class="badge ' + (u.status === "active" ? "badge-status-active" : "badge-status-disabled") + '">' + u.status + '</span></td>' +
        '<td data-label="Actions">' +
          '<button class="btn btn-sm btn-ghost" data-toggle-role="' + u.id + '" data-current-role="' + u.role + '">' + (u.role === "admin" ? "Make User" : "Make Admin") + '</button> ' +
          '<button class="btn btn-sm btn-danger-ghost" data-toggle-status="' + u.id + '" data-current-status="' + u.status + '">' + (u.status === "active" ? "Disable" : "Enable") + '</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  document.getElementById("userSearch").addEventListener("input", renderUsers);
  document.getElementById("userRoleFilter").addEventListener("change", renderUsers);
  document.getElementById("exportUsersBtn").addEventListener("click", function () {
    LD.downloadCsv("users.csv", allUsers.map(function (u) {
      return { name: u.full_name || "", email: u.email, role: u.role, status: u.status, joined: u.created_at };
    }));
  });

  document.getElementById("usersBody").addEventListener("click", async function (e) {
    var roleBtn = e.target.closest("[data-toggle-role]");
    var statusBtn = e.target.closest("[data-toggle-status]");

    if (roleBtn) {
      var id = roleBtn.getAttribute("data-toggle-role");
      var currentRole = roleBtn.getAttribute("data-current-role");
      var nextRole = currentRole === "admin" ? "user" : "admin";

      if (currentRole === "admin" && nextRole === "user") {
        var adminCount = allUsers.filter(function (u) { return u.role === "admin"; }).length;
        if (adminCount <= 1) {
          LD.toast("You can't remove the last administrator.", "error");
          return;
        }
      }
      var { error } = await window.sb.from("profiles").update({ role: nextRole }).eq("id", id);
      if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
      await LD.logActivity(user.id, "role_changed", "Changed a user's role to " + nextRole);
      LD.toast("Role updated.", "success");
      loadUsers();
    }

    if (statusBtn) {
      var id2 = statusBtn.getAttribute("data-toggle-status");
      var currentStatus = statusBtn.getAttribute("data-current-status");
      var nextStatus = currentStatus === "active" ? "disabled" : "active";
      var { error: err2 } = await window.sb.from("profiles").update({ status: nextStatus }).eq("id", id2);
      if (err2) { LD.toast(LD.friendlyError(err2), "error"); return; }
      await LD.logActivity(user.id, "user_status_changed", "Set a user's status to " + nextStatus);
      LD.toast("Status updated.", "success");
      loadUsers();
    }
  });

  /* ---------------- Draws ---------------- */
  var allDraws = [];
  async function loadDraws() {
    var { data, error } = await window.sb
      .from("draws")
      .select("*, profiles(full_name, email), participants(count), draw_results(winner_name, drawn_at)")
      .order("created_at", { ascending: false });
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    allDraws = data || [];
    renderDraws();
  }

  function renderDraws() {
    var search = (document.getElementById("drawSearch").value || "").toLowerCase();
    var rows = allDraws.filter(function (d) {
      return !search || d.draw_name.toLowerCase().indexOf(search) !== -1;
    });
    var tbody = document.getElementById("adminDrawsBody");
    tbody.innerHTML = "";
    if (rows.length === 0) { document.getElementById("adminDrawsEmpty").style.display = "block"; return; }
    document.getElementById("adminDrawsEmpty").style.display = "none";

    rows.forEach(function (d) {
      var count = d.participants && d.participants[0] ? d.participants[0].count : 0;
      var winner = "—";
      if (d.draw_results && d.draw_results.length) {
        var sorted = d.draw_results.slice().sort(function (a, b) { return new Date(b.drawn_at) - new Date(a.drawn_at); });
        winner = sorted[0].winner_name;
      }
      var owner = d.profiles ? (d.profiles.full_name || d.profiles.email) : "—";
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td data-label="Draw Name">' + LD.escapeHtml(d.draw_name) + '</td>' +
        '<td data-label="Owner">' + LD.escapeHtml(owner) + '</td>' +
        '<td data-label="Participants">' + count + '</td>' +
        '<td data-label="Winner">' + LD.escapeHtml(winner) + '</td>' +
        '<td data-label="Created">' + LD.formatDate(d.created_at) + '</td>' +
        '<td data-label="Status"><span class="badge">' + d.status + '</span></td>' +
        '<td data-label="Actions"><button class="btn btn-sm btn-danger-ghost" data-delete-draw="' + d.id + '">Delete</button></td>';
      tbody.appendChild(tr);
    });
  }
  document.getElementById("drawSearch").addEventListener("input", renderDraws);
  document.getElementById("exportDrawsBtn").addEventListener("click", function () {
    LD.downloadCsv("draws.csv", allDraws.map(function (d) {
      return { draw_name: d.draw_name, owner: d.profiles ? d.profiles.email : "", status: d.status, created_at: d.created_at };
    }));
  });

  var pendingDeleteDraw = null;
  document.getElementById("adminDrawsBody").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-delete-draw]");
    if (!btn) return;
    pendingDeleteDraw = btn.getAttribute("data-delete-draw");
    document.getElementById("adminDeleteModal").classList.add("show");
  });
  document.getElementById("adminDeleteCancel").addEventListener("click", function () {
    document.getElementById("adminDeleteModal").classList.remove("show");
  });
  document.getElementById("adminDeleteConfirm").addEventListener("click", async function () {
    if (!pendingDeleteDraw) return;
    var { error } = await window.sb.from("draws").delete().eq("id", pendingDeleteDraw);
    document.getElementById("adminDeleteModal").classList.remove("show");
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    await LD.logActivity(user.id, "draw_deleted_by_admin", "Admin deleted a draw record");
    LD.toast("Draw deleted.", "success");
    loadDraws();
  });

  /* ---------------- Participants ---------------- */
  var allParticipants = [];
  async function loadParticipants() {
    var { data, error } = await window.sb
      .from("participants")
      .select("*, draws(draw_name, user_id, profiles(full_name, email))")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    allParticipants = data || [];
    renderParticipants();
  }
  function renderParticipants() {
    var search = (document.getElementById("participantSearch").value || "").toLowerCase();
    var rows = allParticipants.filter(function (p) {
      return !search || p.name.toLowerCase().indexOf(search) !== -1;
    });
    var tbody = document.getElementById("participantsBody");
    tbody.innerHTML = "";
    if (rows.length === 0) { document.getElementById("participantsEmpty").style.display = "block"; return; }
    document.getElementById("participantsEmpty").style.display = "none";
    rows.forEach(function (p) {
      var drawName = p.draws ? p.draws.draw_name : "—";
      var owner = p.draws && p.draws.profiles ? (p.draws.profiles.full_name || p.draws.profiles.email) : "—";
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td data-label="Name">' + LD.escapeHtml(p.name) + '</td>' +
        '<td data-label="Draw">' + LD.escapeHtml(drawName) + '</td>' +
        '<td data-label="Owner">' + LD.escapeHtml(owner) + '</td>' +
        '<td data-label="Winner">' + (p.is_winner ? "🏆 Yes" : "No") + '</td>' +
        '<td data-label="Created">' + LD.formatDate(p.created_at) + '</td>';
      tbody.appendChild(tr);
    });
  }
  document.getElementById("participantSearch").addEventListener("input", renderParticipants);
  document.getElementById("exportParticipantsBtn").addEventListener("click", function () {
    LD.downloadCsv("participants.csv", allParticipants.map(function (p) {
      return { name: p.name, draw: p.draws ? p.draws.draw_name : "", is_winner: p.is_winner, created_at: p.created_at };
    }));
  });

  /* ---------------- Winners ---------------- */
  var allWinners = [];
  async function loadWinners() {
    var { data, error } = await window.sb
      .from("draw_results")
      .select("*, draws(draw_name, user_id, profiles(full_name, email))")
      .order("drawn_at", { ascending: false })
      .limit(500);
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    allWinners = data || [];
    renderWinners();
  }
  function renderWinners() {
    var search = (document.getElementById("winnerSearch").value || "").toLowerCase();
    var rows = allWinners.filter(function (w) {
      return !search || w.winner_name.toLowerCase().indexOf(search) !== -1;
    });
    var tbody = document.getElementById("winnersBody");
    tbody.innerHTML = "";
    if (rows.length === 0) { document.getElementById("winnersEmpty").style.display = "block"; return; }
    document.getElementById("winnersEmpty").style.display = "none";
    rows.forEach(function (w) {
      var drawName = w.draws ? w.draws.draw_name : "—";
      var owner = w.draws && w.draws.profiles ? (w.draws.profiles.full_name || w.draws.profiles.email) : "—";
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td data-label="Winner"><strong>' + LD.escapeHtml(w.winner_name) + '</strong></td>' +
        '<td data-label="Draw">' + LD.escapeHtml(drawName) + '</td>' +
        '<td data-label="Owner">' + LD.escapeHtml(owner) + '</td>' +
        '<td data-label="Participants">' + w.participant_count + '</td>' +
        '<td data-label="Date">' + LD.formatDateTime(w.drawn_at) + '</td>';
      tbody.appendChild(tr);
    });
  }
  document.getElementById("winnerSearch").addEventListener("input", renderWinners);
  document.getElementById("exportWinnersBtn").addEventListener("click", function () {
    LD.downloadCsv("winners.csv", allWinners.map(function (w) {
      return { winner: w.winner_name, draw: w.draws ? w.draws.draw_name : "", participants: w.participant_count, drawn_at: w.drawn_at };
    }));
  });

  /* ---------------- Activity logs ---------------- */
  async function loadLogs() {
    var { data, error } = await window.sb
      .from("activity_logs")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    var tbody = document.getElementById("logsBody");
    tbody.innerHTML = "";
    if (!data || data.length === 0) { document.getElementById("logsEmpty").style.display = "block"; return; }
    document.getElementById("logsEmpty").style.display = "none";
    data.forEach(function (l) {
      var who = l.profiles ? (l.profiles.full_name || l.profiles.email) : "System";
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td data-label="User">' + LD.escapeHtml(who) + '</td>' +
        '<td data-label="Action"><span class="badge">' + LD.escapeHtml(l.action) + '</span></td>' +
        '<td data-label="Description">' + LD.escapeHtml(l.description) + '</td>' +
        '<td data-label="When">' + LD.formatDateTime(l.created_at) + '</td>';
      tbody.appendChild(tr);
    });
  }

  // Load the first view by default
  loadOverview();
})();
