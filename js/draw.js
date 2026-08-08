(async function () {
  "use strict";

  var ctx = await LDAuth.requireAuth();
  if (!ctx) return;
  var user = ctx.session.user;
  LDAuth.paintHeader(ctx.profile || { email: user.email });

  var drawId = LD.qs("id");
  if (!drawId) { window.location.href = "dashboard.html"; return; }

  var els = {
    loading: document.getElementById("drawLoading"),
    content: document.getElementById("drawContent"),
    drawTitle: document.getElementById("drawTitle"),
    nameInput: document.getElementById("nameInput"),
    addBtn: document.getElementById("addBtn"),
    nameError: document.getElementById("nameError"),
    ticketList: document.getElementById("ticketList"),
    emptyState: document.getElementById("emptyState"),
    countPill: document.getElementById("countPill"),
    clearBtn: document.getElementById("clearParticipantsBtn"),
    removeWinnerToggle: document.getElementById("removeWinnerToggle"),
    drawBtn: document.getElementById("drawBtn"),
    pickAgainBtn: document.getElementById("pickAgainBtn"),
    stageDisplay: document.getElementById("stageDisplay"),
    winnerCard: document.getElementById("winnerCard"),
    winnerName: document.getElementById("winnerName"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    clearModal: document.getElementById("clearModal"),
    clearCancel: document.getElementById("clearCancel"),
    clearConfirm: document.getElementById("clearConfirm")
  };

  var draw = null;
  var participants = [];
  var isDrawing = false;

  async function loadDraw() {
    var { data: drawRow, error: drawErr } = await window.sb.from("draws").select("*").eq("id", drawId).single();
    if (drawErr || !drawRow) {
      LD.toast("That draw could not be found.", "error");
      setTimeout(function () { window.location.href = "dashboard.html"; }, 1200);
      return;
    }
    draw = drawRow;
    els.drawTitle.textContent = draw.draw_name;
    els.removeWinnerToggle.checked = !!draw.remove_winner_after_draw;

    await loadParticipants();
    await loadHistory();

    els.loading.style.display = "none";
    els.content.style.display = "block";
  }

  async function loadParticipants() {
    var { data, error } = await window.sb
      .from("participants")
      .select("*")
      .eq("draw_id", drawId)
      .eq("removed_after_draw", false)
      .order("created_at", { ascending: true });
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    participants = data || [];
    renderParticipants();
  }

  function renderParticipants() {
    els.ticketList.innerHTML = "";
    if (participants.length === 0) {
      els.emptyState.style.display = "block";
    } else {
      els.emptyState.style.display = "none";
      participants.forEach(function (p, idx) {
        var li = document.createElement("li");
        li.className = "ticket";
        li.innerHTML =
          '<span class="num">#' + String(idx + 1).padStart(2, "0") + '</span>' +
          '<span class="name">' + LD.escapeHtml(p.name) + '</span>' +
          '<button class="remove" aria-label="Remove ' + LD.escapeHtml(p.name) + '" data-id="' + p.id + '">✕</button>';
        els.ticketList.appendChild(li);
      });
    }
    els.countPill.textContent = participants.length + (participants.length === 1 ? " person" : " people");
  }

  els.ticketList.addEventListener("click", async function (e) {
    var btn = e.target.closest(".remove");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var { error } = await window.sb.from("participants").delete().eq("id", id);
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    participants = participants.filter(function (p) { return p.id !== id; });
    renderParticipants();
  });

  async function addParticipant() {
    var trimmed = els.nameInput.value.trim();
    els.nameError.textContent = "";
    if (!trimmed) { els.nameError.textContent = "Please enter a name."; els.nameInput.focus(); return; }
    if (trimmed.length > 60) { els.nameError.textContent = "That name is too long."; return; }

    LD.setBusy(els.addBtn, true, "Adding…");
    var { data, error } = await window.sb
      .from("participants")
      .insert({ draw_id: drawId, name: trimmed })
      .select()
      .single();
    LD.setBusy(els.addBtn, false, "+ Add Name");
    if (error) { els.nameError.textContent = LD.friendlyError(error); return; }
    participants.push(data);
    renderParticipants();
    els.nameInput.value = "";
    els.nameInput.focus();
  }
  els.addBtn.addEventListener("click", addParticipant);
  els.nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } });
  els.nameInput.addEventListener("input", function () { els.nameError.textContent = ""; });

  els.removeWinnerToggle.addEventListener("change", async function () {
    var val = els.removeWinnerToggle.checked;
    var { error } = await window.sb.from("draws").update({ remove_winner_after_draw: val }).eq("id", drawId);
    if (error) { LD.toast(LD.friendlyError(error), "error"); els.removeWinnerToggle.checked = !val; return; }
    draw.remove_winner_after_draw = val;
  });

  els.clearBtn.addEventListener("click", function () {
    if (participants.length === 0) return;
    els.clearModal.classList.add("show");
  });
  els.clearCancel.addEventListener("click", function () { els.clearModal.classList.remove("show"); });
  els.clearConfirm.addEventListener("click", async function () {
    LD.setBusy(els.clearConfirm, true, "Clearing…");
    var { error } = await window.sb.from("participants").delete().eq("draw_id", drawId);
    LD.setBusy(els.clearConfirm, false);
    els.clearModal.classList.remove("show");
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    participants = [];
    renderParticipants();
  });

  /* ---------------- Winner history ---------------- */
  async function loadHistory() {
    var { data, error } = await window.sb
      .from("draw_results")
      .select("*")
      .eq("draw_id", drawId)
      .order("drawn_at", { ascending: false });
    if (error) { LD.toast(LD.friendlyError(error), "error"); return; }
    renderHistory(data || []);
  }

  function renderHistory(rows) {
    els.historyList.innerHTML = "";
    if (rows.length === 0) { els.historyEmpty.style.display = "block"; return; }
    els.historyEmpty.style.display = "none";
    rows.forEach(function (h, idx) {
      var li = document.createElement("li");
      li.className = "hist-row";
      li.innerHTML =
        '<span class="rank">' + (rows.length - idx) + '.</span>' +
        '<span class="who" style="font-weight:700;flex:1;">' + LD.escapeHtml(h.winner_name) + '</span>' +
        '<span class="when" style="color:var(--fg-muted);font-size:.8rem;">' + LD.formatDateTime(h.drawn_at) + '</span>';
      li.style.cssText = "display:flex;gap:12px;align-items:baseline;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;";
      els.historyList.appendChild(li);
    });
  }

  /* ---------------- Confetti ---------------- */
  var canvas = document.getElementById("confettiCanvas");
  var cctx = canvas.getContext("2d");
  var pieces = [];
  var raf = null;
  var colors = ["#f2b705", "#ff5c5c", "#a9a6c9", "#fdf9ee", "#d99a02"];
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener("resize", resize); resize();

  function launchConfetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pieces = [];
    for (var i = 0; i < 140; i++) {
      pieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 120, y: canvas.height * 0.35,
        vx: (Math.random() - 0.5) * 9, vy: Math.random() * -9 - 4,
        size: Math.random() * 7 + 4, color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.5 ? "rect" : "circle", gravity: 0.28 + Math.random() * 0.12, life: 0
      });
    }
    if (raf) cancelAnimationFrame(raf);
    animate();
  }
  function animate() {
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = false;
    pieces.forEach(function (p) {
      p.life++; p.vy += p.gravity; p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;
      if (p.y < canvas.height + 40 && p.life < 260) alive = true;
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate((p.rotation * Math.PI) / 180);
      cctx.fillStyle = p.color; cctx.globalAlpha = Math.max(0, 1 - p.life / 260);
      if (p.shape === "rect") cctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      else { cctx.beginPath(); cctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); cctx.fill(); }
      cctx.restore();
    });
    if (alive) raf = requestAnimationFrame(animate); else cctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ---------------- Run the draw ---------------- */
  function runDraw() {
    if (isDrawing) return;
    if (participants.length === 0) {
      els.stageDisplay.textContent = "Please add at least one participant before starting the draw.";
      return;
    }
    isDrawing = true;
    els.drawBtn.disabled = true;
    els.pickAgainBtn.style.display = "none";
    els.winnerCard.classList.remove("show");
    els.stageDisplay.classList.add("cycling");

    var names = participants.map(function (p) { return p.name; });
    var cycles = 0;
    var maxCycles = Math.min(22, names.length * 4 + 10);
    var delay = 70;

    function cycle() {
      var idx = LD.secureRandomIndex(names.length);
      els.stageDisplay.textContent = "🎲 " + names[idx];
      cycles++;
      if (cycles < maxCycles) { delay += 8; setTimeout(cycle, delay); }
      else finishDraw();
    }
    cycle();
  }

  async function finishDraw() {
    var winnerIdx = LD.secureRandomIndex(participants.length);
    var winner = participants[winnerIdx];

    els.stageDisplay.classList.remove("cycling");
    els.stageDisplay.textContent = "";
    els.winnerName.textContent = winner.name;
    els.winnerCard.classList.add("show");
    launchConfetti();

    var { error: resErr } = await window.sb.from("draw_results").insert({
      draw_id: drawId,
      participant_id: winner.id,
      user_id: user.id,
      winner_name: winner.name,
      participant_count: participants.length
    });
    if (resErr) LD.toast(LD.friendlyError(resErr), "error");

    if (draw.remove_winner_after_draw) {
      await window.sb.from("participants").update({ is_winner: true, removed_after_draw: true }).eq("id", winner.id);
      participants = participants.filter(function (p) { return p.id !== winner.id; });
      renderParticipants();
    } else {
      await window.sb.from("participants").update({ is_winner: true }).eq("id", winner.id);
    }

    await LD.logActivity(user.id, "winner_selected", winner.name + ' won "' + draw.draw_name + '"');
    await loadHistory();

    isDrawing = false;
    els.drawBtn.disabled = false;
    els.pickAgainBtn.style.display = "inline-flex";
  }

  els.drawBtn.addEventListener("click", runDraw);
  els.pickAgainBtn.addEventListener("click", function () {
    els.winnerCard.classList.remove("show");
    els.stageDisplay.textContent = "Ready when you are 🎯";
    els.pickAgainBtn.style.display = "none";
    runDraw();
  });

  loadDraw();
})();
