(async function () {
  "use strict";

  var ctx = await LDAuth.requireAuth();
  if (!ctx) return;
  var user = ctx.session.user;
  LDAuth.paintHeader(ctx.profile || { email: user.email });

  var els = {
    loading: document.getElementById("dashLoading"),
    content: document.getElementById("dashContent"),
    statDraws: document.getElementById("statDraws"),
    statParticipants: document.getElementById("statParticipants"),
    statWinners: document.getElementById("statWinners"),
    statLatest: document.getElementById("statLatest"),
    drawsBody: document.getElementById("drawsBody"),
    drawsEmpty: document.getElementById("drawsEmpty"),
    createBtn: document.getElementById("createDrawBtn"),
    modalBackdrop: document.getElementById("createModal"),
    modalCancel: document.getElementById("createCancel"),
    modalConfirm: document.getElementById("createConfirm"),
    drawNameInput: document.getElementById("drawNameInput"),
    createError: document.getElementById("createError"),
    deleteModal: document.getElementById("deleteModal"),
    deleteCancel: document.getElementById("deleteCancel"),
    deleteConfirm: document.getElementById("deleteConfirm"),
    migrateBanner: document.getElementById("migrateBanner"),
    migrateBtn: document.getElementById("migrateBtn"),
    migrateDismiss: document.getElementById("migrateDismiss")
  };

  var pendingDeleteId = null;

  async function loadDashboard() {
    els.loading.style.display = "flex";
    els.content.style.display = "none";

    var { data: draws, error } = await window.sb
      .from("draws")
      .select("id, draw_name, status, created_at, participants(count), draw_results(winner_name, drawn_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      LD.toast(LD.friendlyError(error), "error");
      els.loading.style.display = "none";
      return;
    }

    var totalParticipants = 0;
    var totalWinners = 0;
    var latestDraw = draws && draws.length ? draws[0] : null;

    draws.forEach(function (d) {
      totalParticipants += (d.participants && d.participants[0] ? d.participants[0].count : 0);
      totalWinners += (d.draw_results ? d.draw_results.length : 0);
    });

    els.statDraws.textContent = draws.length;
    els.statParticipants.textContent = totalParticipants;
    els.statWinners.textContent = totalWinners;
    els.statLatest.textContent = latestDraw ? latestDraw.draw_name : "—";

    renderDrawsTable(draws);
    checkLocalMigration();

    els.loading.style.display = "none";
    els.content.style.display = "block";
  }

  function renderDrawsTable(draws) {
    els.drawsBody.innerHTML = "";
    if (!draws || draws.length === 0) {
      els.drawsEmpty.style.display = "block";
      return;
    }
    els.drawsEmpty.style.display = "none";

    draws.forEach(function (d) {
      var count = d.participants && d.participants[0] ? d.participants[0].count : 0;
      var latestWinner = "—";
      if (d.draw_results && d.draw_results.length) {
        var sorted = d.draw_results.slice().sort(function (a, b) { return new Date(b.drawn_at) - new Date(a.drawn_at); });
        latestWinner = sorted[0].winner_name;
      }
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td data-label="Draw Name"><strong>' + LD.escapeHtml(d.draw_name) + '</strong></td>' +
        '<td data-label="Participants">' + count + '</td>' +
        '<td data-label="Winner">' + LD.escapeHtml(latestWinner) + '</td>' +
        '<td data-label="Date">' + LD.formatDate(d.created_at) + '</td>' +
        '<td data-label="Status"><span class="badge">' + LD.escapeHtml(d.status) + '</span></td>' +
        '<td data-label="Actions">' +
          '<a class="btn btn-sm btn-ghost" href="draw.html?id=' + d.id + '">View</a> ' +
          '<button class="btn btn-sm btn-danger-ghost" data-delete="' + d.id + '">Delete</button>' +
        '</td>';
      els.drawsBody.appendChild(tr);
    });
  }

  els.drawsBody.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-delete]");
    if (!btn) return;
    pendingDeleteId = btn.getAttribute("data-delete");
    els.deleteModal.classList.add("show");
  });
  els.deleteCancel.addEventListener("click", function () { els.deleteModal.classList.remove("show"); pendingDeleteId = null; });
  els.deleteConfirm.addEventListener("click", async function () {
    if (!pendingDeleteId) return;
    LD.setBusy(els.deleteConfirm, true, "Deleting…");
    var { error } = await window.sb.from("draws").delete().eq("id", pendingDeleteId);
    LD.setBusy(els.deleteConfirm, false);
    els.deleteModal.classList.remove("show");
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    LD.toast("Draw deleted.", "success");
    await LD.logActivity(user.id, "draw_deleted", "Deleted a draw");
    loadDashboard();
  });

  els.createBtn.addEventListener("click", function () {
    els.drawNameInput.value = "";
    els.createError.textContent = "";
    els.modalBackdrop.classList.add("show");
    els.drawNameInput.focus();
  });
  els.modalCancel.addEventListener("click", function () { els.modalBackdrop.classList.remove("show"); });

  els.modalConfirm.addEventListener("click", async function () {
    var name = els.drawNameInput.value.trim();
    if (!name) {
      els.createError.textContent = "Please enter a draw name.";
      return;
    }
    LD.setBusy(els.modalConfirm, true, "Creating…");
    var { data, error } = await window.sb
      .from("draws")
      .insert({ user_id: user.id, draw_name: name })
      .select()
      .single();
    LD.setBusy(els.modalConfirm, false);
    if (error) {
      els.createError.textContent = LD.friendlyError(error);
      return;
    }
    await LD.logActivity(user.id, "draw_created", 'Created draw "' + name + '"');
    window.location.href = "draw.html?id=" + data.id;
  });

  /* ---- One-time localStorage migration from the old single-file version ---- */
  function checkLocalMigration() {
    var already = localStorage.getItem("luckydraw_migrated");
    var oldParticipants = null;
    try { oldParticipants = JSON.parse(localStorage.getItem("luckydraw_participants") || "null"); } catch (e) {}
    if (already || !oldParticipants || !oldParticipants.length) {
      els.migrateBanner.style.display = "none";
      return;
    }
    els.migrateBanner.style.display = "flex";
  }

  if (els.migrateDismiss) {
    els.migrateDismiss.addEventListener("click", function () {
      els.migrateBanner.style.display = "none";
    });
  }
  if (els.migrateBtn) {
    els.migrateBtn.addEventListener("click", async function () {
      var oldParticipants = [];
      try { oldParticipants = JSON.parse(localStorage.getItem("luckydraw_participants") || "[]"); } catch (e) {}
      if (!oldParticipants.length) return;
      LD.setBusy(els.migrateBtn, true, "Importing…");
      try {
        var { data: draw, error: drawErr } = await window.sb
          .from("draws")
          .insert({ user_id: user.id, draw_name: "Imported Draw" })
          .select()
          .single();
        if (drawErr) throw drawErr;
        var rows = oldParticipants.map(function (p) { return { draw_id: draw.id, name: p.name }; });
        var { error: partErr } = await window.sb.from("participants").insert(rows);
        if (partErr) throw partErr;
        localStorage.setItem("luckydraw_migrated", "1");
        LD.toast("Imported " + rows.length + " participants into a new draw.", "success");
        els.migrateBanner.style.display = "none";
        loadDashboard();
      } catch (err) {
        LD.toast(LD.friendlyError(err), "error");
      }
      LD.setBusy(els.migrateBtn, false);
    });
  }

  loadDashboard();
})();
