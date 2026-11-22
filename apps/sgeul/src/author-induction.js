// Sgeul author induction foundation.
// Production gate: applications stay OFF until privacy, DB migration, RLS checks,
// administrator readiness and a new Play test build have been approved.
export const AUTHOR_INDUCTION_ENABLED = false;

export function validateAuthorFields(raw, application = false) {
  const publishing_name = String(raw.publishing_name || "").trim();
  const biography = String(raw.biography || "").trim();
  const genres = String(raw.genres || "").trim();
  const website_url = String(raw.website_url || "").trim();
  const motivation = String(raw.motivation || "").trim();
  if (publishing_name.length < 2 || publishing_name.length > 100)
    throw Error("Add a publishing name of 2–100 characters.");
  if (biography.length < 40 || biography.length > 1200)
    throw Error("Write an author biography of 40–1,200 characters.");
  if (genres.length > 180)
    throw Error("Keep your genres and interests within 180 characters.");
  if (website_url.length > 300 ||
    (website_url && (!/^https:\/\/[^\s]+$/i.test(website_url) || !safeWebsite(website_url))))
    throw Error("Use a valid HTTPS website address, or leave it blank.");
  const profile = { publishing_name, biography, genres, website_url };
  if (!application) return profile;
  if (motivation.length < 25 || motivation.length > 1000)
    throw Error("Tell us why you would like to join, in 25–1,000 characters.");
  if (raw.charter_acknowledged !== true || raw.privacy_acknowledged !== true)
    throw Error("Review the Charter and Privacy Policy before applying.");
  return { ...profile, motivation, charter_acknowledged: true, privacy_acknowledged: true };
}
function safeWebsite(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

export function createAuthorInduction({ client, isOnline, enabled = AUTHOR_INDUCTION_ENABLED }) {
  const $ = id => document.getElementById(id);
  const form = $("author-induction-form");
  const profileForm = $("author-profile-form");
  const intro = $("author-induction-intro");
  const state = $("author-induction-status");
  let activeUser = null;
  let application = null;
  let privateProfile = null;
  let epoch = 0;
  let saving = false;

  const setStatus = message => { state.textContent = message; };
  const show = (applicationForm = false, approvedForm = false) => {
    form.hidden = !applicationForm;
    profileForm.hidden = !approvedForm;
    intro.hidden = applicationForm || approvedForm;
  };
  function clear() {
    epoch++;
    activeUser = null;
    application = null;
    privateProfile = null;
    form.reset();
    profileForm.reset();
    show();
    setStatus("");
  }

  async function open(user) {
    const current = ++epoch;
    activeUser = user || null;
    application = null;
    privateProfile = null;
    show();
    if (!user) {
      setStatus("Sign in with your Blackwood account to explore author induction.");
      return;
    }
    if (!enabled) {
      setStatus("Author induction is being prepared. Applications are not yet open.");
      return;
    }
    if (!isOnline()) {
      setStatus("Reconnect to the internet to check author induction. Private author data is not saved offline.");
      return;
    }
    setStatus("Checking your author induction status…");
    const { data, error } = await client.from("sgeul_author_inductions")
      .select("user_id,publishing_name,biography,genres,website_url,status")
      .eq("user_id", user.id).maybeSingle();
    if (current !== epoch || activeUser?.id !== user.id) return;
    if (error) {
      setStatus("The author induction service is not available yet. Your reader access is unchanged.");
      return;
    }
    application = data || null;
    if (!data) {
      show(true, false);
      setStatus("Induction applications are open for Blackwood account holders. Applying does not guarantee approval or publication.");
    } else if (data.status === "approved") {
      const answer = await client.from("sgeul_author_profiles")
        .select("user_id,publishing_name,biography,genres,website_url")
        .eq("user_id", user.id).maybeSingle();
      if (current !== epoch || activeUser?.id !== user.id) return;
      if (answer.error) {
        setStatus("Your approval is recorded, but your private profile could not be loaded.");
        return;
      }
      privateProfile = answer.data || null;
      const values = privateProfile || data;
      for (const key of ["publishing_name", "biography", "genres", "website_url"])
        profileForm.elements.namedItem(key).value = values[key] || "";
      show(false, true);
      setStatus("Induction approved. You can prepare your private profile; it is not published to readers.");
    } else {
      show();
      setStatus(
        data.status === "submitted" ? "Your author induction application is awaiting review. No author permissions have been granted." :
        data.status === "declined" ? "Your application was not approved. You can contact Blackwood for further information." :
        "Your author induction has been suspended. Your profile is not available."
      );
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!enabled || saving || !activeUser || application) return;
    if (!isOnline()) { setStatus("Reconnect before submitting an application."); return; }
    try {
      const raw = Object.fromEntries(new FormData(form));
      const payload = validateAuthorFields({
        ...raw,
        charter_acknowledged: $("induction-charter").checked,
        privacy_acknowledged: $("induction-privacy").checked
      }, true);
      saving = true;
      $("induction-submit").disabled = true;
      const userId = activeUser.id;
      const { error } = await client.from("sgeul_author_inductions")
        .insert({ user_id: userId, ...payload });
      if (error) throw Error("The induction request could not be sent. Check your account and try again.");
      if (activeUser?.id === userId) await open(activeUser);
    } catch (error) {
      setStatus(error.message || "Could not submit the induction request.");
    } finally {
      saving = false;
      $("induction-submit").disabled = false;
    }
  });
  profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!enabled || saving || !activeUser || application?.status !== "approved") return;
    if (!isOnline()) { setStatus("Reconnect before saving your private profile."); return; }
    try {
      const payload = validateAuthorFields(Object.fromEntries(new FormData(profileForm)));
      saving = true;
      $("author-profile-save").disabled = true;
      const userId = activeUser.id;
      const request = privateProfile
        ? client.from("sgeul_author_profiles").update(payload).eq("user_id", userId)
        : client.from("sgeul_author_profiles").insert({ user_id: userId, ...payload });
      const { error } = await request;
      if (error) throw Error("Your private profile could not be saved. Try again.");
      if (activeUser?.id === userId) {
        privateProfile = { user_id: userId, ...payload };
        setStatus("Your private author profile has been saved. It is not visible to readers.");
      }
    } catch (error) {
      setStatus(error.message || "Could not save your private profile.");
    } finally {
      saving = false;
      $("author-profile-save").disabled = false;
    }
  });
  return { open, clear };
}
