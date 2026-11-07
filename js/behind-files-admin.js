"use strict";

// ==========================================
// BLACKWOOD PUBLISHING
// BEHIND THE FILES ADMIN
//
// Supabase administrator verification
// Behind the Files drafting tools
// Protected Public / Members-only publishing
// Live preview and existing posts
//
// Dispatches save to Supabase through an administrator-only RPC.
//
// IMPORTANT:
// Client-side access checks protect the UI.
// Confidential data must also be protected
// by Supabase Row Level Security (RLS).
// ==========================================

(function () {
    const SUPABASE_URL =
        "https://bmnlynjldlnxfvunqbqq.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    const MEMBERS_URL = "/pages/members.html";

    let supabaseClient = null;
    let editorInitialized = false;
    let accessCheckVersion = 0;
    let dispatchEditor = null;

    // ==========================================
    // PAGE INITIALISATION
    // ==========================================

    window.addEventListener("load", async function () {
        const accessScreen =
            document.getElementById("bfa-access-screen");

        const adminContent =
            document.getElementById("bfa-admin-content");

        if (!accessScreen || !adminContent) {
            console.error(
                "Behind the Files Admin: Access screen or editor is missing."
            );
            return;
        }

        // Always start with the editor hidden.
        adminContent.hidden = true;
        accessScreen.hidden = false;

        try {
            if (typeof loadHeader === "function") {
                await loadHeader("simple");
            }
        } catch (error) {
            console.warn("Header could not be loaded:", error);
        }

        await initializeAdminAccess();
    });

    // ==========================================
    // SUPABASE INITIALISATION
    // ==========================================

    async function initializeAdminAccess() {
        showAccessMessage(
            "Verifying Access",
            "Checking your Archivist credentials..."
        );

        try {
            await loadSupabaseLibrary();

            if (
                !window.supabase ||
                typeof window.supabase.createClient !== "function"
            ) {
                throw new Error("Supabase library is unavailable.");
            }

            supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );

            // Recheck whenever the session changes.
            // Keep the callback synchronous to avoid
            // calling Supabase methods inside it.
            supabaseClient.auth.onAuthStateChange(function (event) {
                if (event === "SIGNED_OUT") {
                    accessCheckVersion += 1;
                    lockAdminEditor();
                    dispatchEditor?.clear();

                    showAccessMessage(
                        "Sign In Required",
                        "Your Archivist session has ended. Please sign in again through The Archivists."
                    );

                    return;
                }

                if (
                    event === "SIGNED_IN" ||
                    event === "TOKEN_REFRESHED" ||
                    event === "USER_UPDATED"
                ) {
                    // Defer verification until the auth event
                    // callback has completed.
                    window.setTimeout(function () {
                        verifyAdminAccess();
                    }, 0);
                }
            });

            await verifyAdminAccess();

        } catch (error) {
            console.error(
                "Behind the Files Admin: Authentication setup failed.",
                error
            );

            lockAdminEditor();

            showAccessMessage(
                "Access Unavailable",
                "We could not verify your administrator credentials. Please return to The Archivists and try again."
            );
        }
    }

    function loadSupabaseLibrary() {
        return new Promise(function (resolve, reject) {
            if (
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {
                resolve();
                return;
            }

            const script = document.createElement("script");

            script.src = SUPABASE_CDN;
            script.async = true;

            script.onload = function () {
                if (
                    window.supabase &&
                    typeof window.supabase.createClient === "function"
                ) {
                    resolve();
                } else {
                    reject(
                        new Error("Supabase loaded without createClient.")
                    );
                }
            };

            script.onerror = function () {
                reject(
                    new Error("Failed to load the Supabase library.")
                );
            };

            document.head.appendChild(script);
        });
    }

    // ==========================================
    // ADMIN VERIFICATION
    // ==========================================

    async function verifyAdminAccess() {
        const checkVersion = ++accessCheckVersion;

        lockAdminEditor(false);

        showAccessMessage(
            "Verifying Access",
            "Checking your Archivist administrator permission..."
        );

        if (!supabaseClient) {
            showAccessMessage(
                "Access Unavailable",
                "The administrator connection is not ready."
            );
            return;
        }

        try {
            // getUser() validates the current user
            // with the Supabase Auth server.
            const userResult =
                await supabaseClient.auth.getUser();

            if (checkVersion !== accessCheckVersion) {
                return;
            }

            if (userResult.error || !userResult.data.user) {
                showAccessMessage(
                    "Sign In Required",
                    "Please sign in to The Archivists before opening the Blackwood Management Hub."
                );
                return;
            }

            const user = userResult.data.user;

            // Check the permission from the existing
            // Blackwood member_profiles table.
            const profileResult = await supabaseClient
                .from("member_profiles")
                .select("is_admin")
                .eq("id", user.id)
                .maybeSingle();

            if (checkVersion !== accessCheckVersion) {
                return;
            }

            if (profileResult.error) {
                console.error(
                    "Behind the Files Admin: Profile lookup failed.",
                    profileResult.error
                );

                showAccessMessage(
                    "Access Unavailable",
                    "Your administrator permission could not be verified. Please try again later."
                );
                return;
            }

            const profile = profileResult.data;

            const isAdmin =
                profile &&
                (
                    profile.is_admin === true ||
                    String(profile.is_admin).toLowerCase() === "true"
                );

            if (!isAdmin) {
                lockAdminEditor();
                showAccessMessage(
                    "Access Denied",
                    "This area is reserved for Blackwood Publishing management."
                );
                return;
            }

            unlockAdminEditor();
            dispatchEditor?.activate(user.id);
            window.BlackwoodPlanner?.activate(user.id);
            window.BlackwoodOperations?.activate(user.id,supabaseClient);

        } catch (error) {
            if (checkVersion !== accessCheckVersion) {
                return;
            }

            console.error(
                "Behind the Files Admin: Verification failed.",
                error
            );

            lockAdminEditor();

            showAccessMessage(
                "Access Unavailable",
                "We could not verify your administrator access. Please return to The Archivists and try again."
            );
        }
    }

    function lockAdminEditor(clearOperations = true) {
        dispatchEditor?.suspend();
        window.BlackwoodPlanner?.lock();
        if(clearOperations)window.BlackwoodOperations?.lock();
        else window.BlackwoodOperations?.suspend();
        const adminContent =
            document.getElementById("bfa-admin-content");

        const accessScreen =
            document.getElementById("bfa-access-screen");

        if (adminContent) {
            adminContent.hidden = true;
        }

        if (accessScreen) {
            accessScreen.hidden = false;
        }
    }

    function unlockAdminEditor() {
        const adminContent =
            document.getElementById("bfa-admin-content");

        const accessScreen =
            document.getElementById("bfa-access-screen");

        if (!adminContent || !accessScreen) {
            return;
        }

        if (!editorInitialized) {
            const success = adminContent.dataset.adminTool === "production-planner"
                ? Boolean(window.BlackwoodPlanner)
                : initBehindFilesAdmin();

            if (!success) {
                showAccessMessage(
                    "Editor Unavailable",
                    "The Behind the Files drafting desk could not be initialised."
                );
                return;
            }

            editorInitialized = true;
        }

        adminContent.hidden = false;
        accessScreen.hidden = true;
    }

    function showAccessMessage(title, message) {
        const titleElement =
            document.getElementById("bfa-access-title");

        const messageElement =
            document.getElementById("bfa-access-message");

        if (titleElement) {
            titleElement.textContent = title;
        }

        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // ==========================================
    // BEHIND THE FILES EDITOR
    // ==========================================

    function initBehindFilesAdmin() {
        const field = id => document.getElementById(id);
        const form = field("bfa-form");
        const title = field("bfa-post-title"), category = field("bfa-category");
        const date = field("bfa-date"), image = field("bfa-image");
        const excerpt = field("bfa-excerpt"), body = field("bfa-body");
        const audience = field("bfa-audience"), published = field("bfa-published"), pinned = field("bfa-pinned");
        const save = field("bfa-save"), refresh = field("bfa-refresh"), status = field("bfa-status");
        const list = field("bfa-existing-list"), heading = field("bfa-form-title");
        if ([form,title,category,date,image,excerpt,body,audience,published,pinned,save,refresh,status,list,heading].some(node => !node)) {
            console.error("Behind the Files Admin: Required editor elements are missing.");
            return false;
        }
        let adminId = null, generation = 0, loadVersion = 0, busy = false, saveAttempt = 0;
        let editingId = "bfa-" + crypto.randomUUID(), editingRevision = null;
        let records = new Map(), setupMissing = false;
        const today = () => new Date().toISOString().slice(0,10);
        const setupCodes = ["42P01", "42883", "PGRST202", "PGRST205"];

        function setStatus(message, kind = "") {
            status.textContent = message;
            status.classList.remove("is-success", "is-error");
            if (kind) status.classList.add(kind);
        }
        function updateControls() {
            save.disabled = !adminId || busy;
            refresh.disabled = !adminId || busy;
            for (const control of form.querySelectorAll("input,select,textarea,button[type=reset]")) control.disabled = !adminId || busy;
            for (const button of list.querySelectorAll("button")) button.disabled = !adminId || busy;
            form.setAttribute("aria-busy", String(busy));
        }
        function imageUrl(value) {
            const raw = String(value || "").trim() || "/assets/ArchiveFilesBG.png";
            if (raw.startsWith("/assets/")) return raw;
            try { const url = new URL(raw); if (url.protocol === "https:") return url.href; } catch {}
            return null;
        }
        function updatePreview() {
            field("bfa-preview-image").src = imageUrl(image.value) || "/assets/ArchiveFilesBG.png";
            field("bfa-preview-category").textContent = category.value || "Weekly Dispatch";
            field("bfa-preview-date").textContent = formatDate(date.value || today());
            field("bfa-preview-pinned").hidden = !pinned.checked;
            field("bfa-preview-audience").textContent = audience.value === "public" ? "Public" : "Members only";
            field("bfa-preview-publication").textContent = published.checked ? "Published on save" : "Draft";
            field("bfa-preview-heading").textContent = title.value.trim() || "This Week at Blackwood";
            field("bfa-preview-excerpt").textContent = excerpt.value.trim() || "A short preview of the dispatch will appear here.";
            field("bfa-preview-body").innerHTML = formatPlainText(body.value.trim() || "Your full update will appear here as you draft it.");
        }
        [title,category,date,image,excerpt,body,audience,published,pinned].forEach(node => {
            node.addEventListener("input", updatePreview);
            node.addEventListener("change", updatePreview);
        });
        function resetDraft() {
            editingId = "bfa-" + crypto.randomUUID();
            editingRevision = null;
            date.value = today();
            image.value = "/assets/ArchiveFilesBG.png";
            audience.value = "members";
            published.checked = false;
            pinned.checked = false;
            heading.textContent = "Create an update";
            setStatus("");
            updatePreview();
        }
        form.addEventListener("reset", event => {
            if (busy && adminId) { event.preventDefault(); return; }
            setTimeout(resetDraft, 0);
        });
        function editPost(id) {
            if (!adminId || busy) return;
            const row = records.get(id);
            if (!row) return;
            editingId = row.id;
            editingRevision = row.revision;
            title.value = row.title || "";
            if (![...category.options].some(option => option.value === row.category)) category.add(new Option(row.category, row.category));
            category.value = row.category || "Weekly Dispatch";
            date.value = String(row.published_at || "").slice(0,10) || today();
            image.value = row.image_url || "/assets/ArchiveFilesBG.png";
            excerpt.value = row.excerpt || "";
            body.value = row.body || "";
            audience.value = row.audience === "public" ? "public" : "members";
            published.checked = row.published === true;
            pinned.checked = row.pinned === true;
            heading.textContent = "Edit update";
            setStatus("Editing this saved update. Changes are published only when you save.");
            updatePreview();
            title.focus();
        }
        function appendPost(row, legacy = false) {
            const article = document.createElement("article");
            article.className = "bfa-existing-item";
            const meta = document.createElement("p"), name = document.createElement("h3"), detail = document.createElement("p");
            meta.className = "bfa-status-pill";
            meta.textContent = legacy ? "Legacy public-file archive" : (row.audience === "public" ? "Public" : "Members only") + (row.published ? " · Published" : " · Draft");
            name.textContent = row.title || "Untitled update";
            detail.textContent = String(row.published_at || row.publishedAt || "").slice(0,10) + (row.pinned ? " · Pinned" : "");
            article.append(meta, name, detail);
            if (!legacy) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "bfa-button";
                button.textContent = "Edit update";
                button.disabled = !adminId || busy;
                button.addEventListener("click", () => editPost(row.id));
                article.append(button);
            }
            list.append(article);
        }
        function showListMessage(message) {
            const node = document.createElement("p"); node.className = "bfa-muted"; node.textContent = message; list.replaceChildren(node);
        }
        async function loadLegacyArchive(ownGeneration, ownLoad) {
            // Legacy entries are already public files. New private drafts never use this path.
            try {
                const response = await fetch("/data/BFA.json", {cache:"no-store"});
                if (!response.ok) return;
                const data = await response.json();
                if (!adminId || ownGeneration !== generation || ownLoad !== loadVersion) return;
                const posts = Array.isArray(data.posts) ? data.posts : [];
                for (const row of posts.slice(0,20)) appendPost(row, true);
            } catch { /* Keep the setup message; do not make other hub tools unavailable. */ }
        }
        async function loadExistingPosts() {
            if (!adminId) return;
            const ownGeneration = generation, ownLoad = ++loadVersion;
            refresh.disabled = true;
            showListMessage("Loading saved updates…");
            try {
                const result = await supabaseClient.from("bp_dispatches").select("*").order("published_at", {ascending:false}).limit(100);
                if (!adminId || ownGeneration !== generation || ownLoad !== loadVersion) return;
                if (result.error) {
                    if (setupCodes.includes(result.error.code)) {
                        records.clear();
                        setupMissing = true;
                        showListMessage("Protected publishing storage needs setup. The legacy public-file archive is shown below; import it before editing these entries.");
                        setStatus("Apply the dispatch migration in the Blackwood Supabase project before saving. Your draft remains here.", "is-error");
                        await loadLegacyArchive(ownGeneration, ownLoad);
                        return;
                    }
                    throw result.error;
                }
                records = new Map((Array.isArray(result.data) ? result.data : []).map(row => [String(row.id), row]));
                if (setupMissing) { setupMissing = false; setStatus("Publishing storage is ready. Your draft has been kept."); }
                list.replaceChildren();
                for (const row of records.values()) appendPost(row);
                if (!records.size) showListMessage("No updates have been saved yet. Create a draft to begin.");
            } catch {
                if (adminId && ownGeneration === generation && ownLoad === loadVersion) showListMessage("Saved updates could not be checked. Reconnect and refresh; your open draft has been kept.");
            } finally {
                if (ownLoad === loadVersion) refresh.disabled = !adminId || busy;
            }
        }
        function saveError(error) {
            if (setupCodes.includes(error?.code)) return "Protected publishing needs the dispatch migration first. Your draft remains here.";
            if (error?.code === "40001") return "This update changed elsewhere. Refresh saved updates and open the latest version before saving. Your draft remains here.";
            if (error?.code === "42501") return "Administrator access could not be verified. Sign in again before saving. Your draft remains here.";
            if (error?.code === "22023") return "Check the required fields, image URL and date. Published dates cannot be in the future. Your draft remains here.";
            return "The save could not be confirmed. Refresh saved updates before retrying; your draft remains here.";
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (!adminId || busy || !form.reportValidity()) return;
            if (!navigator.onLine) { setStatus("Reconnect before saving. Your draft remains here.", "is-error"); return; }
            const cleanImage = imageUrl(image.value);
            if (!cleanImage || !date.value) { setStatus("Enter a valid published date and an HTTPS or site-relative image URL.", "is-error"); return; }
            const payload = {id:editingId,title:title.value.trim(),category:category.value,excerpt:excerpt.value.trim(),body:body.value.trim(),image_url:cleanImage,audience:audience.value,published:published.checked,pinned:pinned.checked,published_at:date.value + "T00:00:00.000Z"};
            if (!payload.title || !payload.body) { setStatus("Enter a title and main body.", "is-error"); return; }
            const ownGeneration = generation, userId = adminId, attempt = ++saveAttempt;
            busy = true; updateControls(); setStatus("Saving update…");
            try {
                const userResult = await supabaseClient.auth.getUser();
                if (!adminId || ownGeneration !== generation) return;
                if (userResult.error || userResult.data?.user?.id !== userId) throw {code:"42501"};
                const result = await supabaseClient.rpc("bp_dispatch_save", {p_payload:payload,p_expected_revision:editingRevision});
                if (!adminId || ownGeneration !== generation) return;
                if (result.error) throw result.error;
                const row = Array.isArray(result.data) ? result.data[0] : result.data;
                if (!row || row.id !== payload.id || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 1) throw Error("Unconfirmed save");
                editingId = row.id; editingRevision = Number(row.revision);
                heading.textContent = "Edit update";
                setStatus(row.published ? row.audience === "public" ? "Published. This public update can appear on the homepage and in the members area." : "Published for signed-in members only." : "Draft saved. Only administrators can see it.", "is-success");
                await loadExistingPosts();
            } catch (error) {
                if (adminId && ownGeneration === generation) setStatus(saveError(error), "is-error");
            } finally {
                if (attempt === saveAttempt) {
                    busy = false; updateControls();
                    if (adminId && ownGeneration !== generation) {
                        setStatus("Access was rechecked while saving. Refresh saved updates to confirm the result before retrying; your draft remains here.", "is-error");
                        void loadExistingPosts();
                    }
                }
            }
        });
        refresh.addEventListener("click", loadExistingPosts);
        dispatchEditor = {
            activate(userId) { adminId = userId; generation += 1; updateControls(); void loadExistingPosts(); },
            suspend() { adminId = null; generation += 1; loadVersion += 1; updateControls(); },
            clear() { form.reset(); records.clear(); showListMessage("Sign in as an administrator to load updates."); }
        };
        resetDraft();
        updateControls();
        return true;
    }

    // ==========================================
    // SHARED UTILITIES
    // ==========================================

    function formatDate(value) {
        if (!value) {
            return "Filed today";
        }

        const date = new Date(value + "T12:00:00");

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatPlainText(value) {
        const clean = escapeHtml(value || "");

        if (!clean) {
            return "";
        }

        return clean
            .split(/\n{2,}/)
            .map(function (paragraph) {
                return "<p>" +
                    paragraph.replace(/\n/g, "<br>") +
                    "</p>";
            })
            .join("");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
