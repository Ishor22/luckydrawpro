// Authentication helpers. Depends on supabase.js and utils.js being loaded first.
window.LDAuth = (function () {

  async function signUp(fullName, email, password) {
    var { data, error } = await window.sb.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    var { data, error } = await window.sb.auth.signInWithPassword({ email: email, password: password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await window.sb.auth.signOut();
    window.location.href = "login.html";
  }

  async function sendPasswordReset(email) {
    var redirectTo = window.location.origin + window.location.pathname.replace(/[^/]*$/, "reset-password.html");
    var { error } = await window.sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    var { error } = await window.sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function getSession() {
    var { data } = await window.sb.auth.getSession();
    return data.session || null;
  }

  async function getProfile(userId) {
    var { data, error } = await window.sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  }

  // Redirects to login.html if not signed in. Returns { session, profile }.
  async function requireAuth() {
    var session = await getSession();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
    var profile = null;
    try {
      profile = await getProfile(session.user.id);
    } catch (e) {
      console.warn("Could not load profile", e);
    }
    return { session: session, profile: profile };
  }

  // Redirects non-admins away. Returns { session, profile } only for admins.
  async function requireAdmin() {
    var ctx = await requireAuth();
    if (!ctx) return null;
    if (!ctx.profile || ctx.profile.role !== "admin") {
      window.location.href = "dashboard.html";
      return null;
    }
    return ctx;
  }

  // Fills in the shared header (name + avatar initial) once profile is known.
  function paintHeader(profile) {
    document.querySelectorAll("[data-user-name]").forEach(function (el) {
      el.textContent = profile.full_name || profile.email;
    });
    document.querySelectorAll("[data-user-initial]").forEach(function (el) {
      var source = profile.full_name || profile.email || "?";
      el.textContent = source.trim().charAt(0).toUpperCase();
    });
  }

  return {
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    sendPasswordReset: sendPasswordReset,
    updatePassword: updatePassword,
    getSession: getSession,
    getProfile: getProfile,
    requireAuth: requireAuth,
    requireAdmin: requireAdmin,
    paintHeader: paintHeader
  };
})();
