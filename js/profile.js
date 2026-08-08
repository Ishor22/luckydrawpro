(async function () {
  "use strict";

  var ctx = await LDAuth.requireAuth();
  if (!ctx) return;
  var user = ctx.session.user;
  var profile = ctx.profile;
  LDAuth.paintHeader(profile || { email: user.email });

  var els = {
    loading: document.getElementById("profileLoading"),
    content: document.getElementById("profileContent"),
    avatarInitial: document.getElementById("profileAvatarInitial"),
    fullNameInput: document.getElementById("fullNameInput"),
    emailDisplay: document.getElementById("emailDisplay"),
    joinedDisplay: document.getElementById("joinedDisplay"),
    roleDisplay: document.getElementById("roleDisplay"),
    saveBtn: document.getElementById("saveProfileBtn"),
    saveMsg: document.getElementById("saveMsg"),
    newPassword: document.getElementById("newPassword"),
    updatePasswordBtn: document.getElementById("updatePasswordBtn"),
    passwordMsg: document.getElementById("passwordMsg")
  };

  if (!profile) {
    LD.toast("Could not load your profile.", "error");
    return;
  }

  els.avatarInitial.textContent = (profile.full_name || profile.email || "?").trim().charAt(0).toUpperCase();
  els.fullNameInput.value = profile.full_name || "";
  els.emailDisplay.textContent = profile.email;
  els.joinedDisplay.textContent = LD.formatDate(profile.created_at);
  els.roleDisplay.textContent = profile.role === "admin" ? "Administrator" : "User";

  els.loading.style.display = "none";
  els.content.style.display = "block";

  els.saveBtn.addEventListener("click", async function () {
    var name = els.fullNameInput.value.trim();
    els.saveMsg.textContent = "";
    if (!name) { els.saveMsg.textContent = "Name cannot be empty."; return; }
    LD.setBusy(els.saveBtn, true, "Saving…");
    var { error } = await window.sb.from("profiles").update({ full_name: name }).eq("id", user.id);
    LD.setBusy(els.saveBtn, false, "Save Changes");
    if (error) { els.saveMsg.textContent = LD.friendlyError(error); return; }
    LD.toast("Profile updated.", "success");
    els.avatarInitial.textContent = name.charAt(0).toUpperCase();
  });

  els.updatePasswordBtn.addEventListener("click", async function () {
    var pw = els.newPassword.value;
    els.passwordMsg.textContent = "";
    if (!pw || pw.length < 6) { els.passwordMsg.textContent = "Password must be at least 6 characters."; return; }
    LD.setBusy(els.updatePasswordBtn, true, "Updating…");
    try {
      await LDAuth.updatePassword(pw);
      LD.toast("Password updated.", "success");
      els.newPassword.value = "";
    } catch (err) {
      els.passwordMsg.textContent = LD.friendlyError(err);
    }
    LD.setBusy(els.updatePasswordBtn, false, "Update Password");
  });
})();
