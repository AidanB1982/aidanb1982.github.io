// =========================
// BLACKWOOD CIRCLE MEMBERS
// Supabase Auth + Member Dashboard
// =========================

const BLACKWOOD_MEMBERS_CONFIG = {
    supabaseUrl: "https://bmnlynjldlnxfvunqbqq.supabase.co",
    supabaseKey: "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",
    membersPagePath: "/pages/members.html",
    supabaseCdn: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
};

const BlackwoodMembersState = {
    app: null,
    client: null,
    session: null,
    member: null,
    posts: [],
    rewards: [],
    points: [],
    activeAuthMode: "signin",
    isLoading: false
};

document.addEventListener("DOMContentLoaded", () => {
    initBlackwoodMembersArea();
});

async function initBlackwoodMembersArea() {
    const app = document.getElementById("blackwood-circle-app");

    if (!app) {
        console.warn("Blackwood Circle: #blackwood-circle-app not found.");
        return;
    }

    BlackwoodMembersState.app = app;

    renderLoadingState("Opening the Blackwood Circle...");

    try {
        await loadSupabaseLibrary();

        BlackwoodMembersState.client = window.supabase.createClient(
            BLACKWOOD_MEMBERS_CONFIG.supabaseUrl,
            BLACKWOOD_MEMBERS_CONFIG.supabaseKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

        const { data, error } = await BlackwoodMembersState.client.auth.getSession();

        if (error) {
            throw error;
        }

        BlackwoodMembersState.session = data.session || null;

        BlackwoodMembersState.client.auth.onAuthStateChange((_event, session) => {
            BlackwoodMembersState.session = session || null;

            if (BlackwoodMembersState.session) {
                loadMemberDashboard();
            } else {
                renderAuthView();
            }
        });

        if (BlackwoodMembersState.session) {
            await loadMemberDashboard();
        } else {
            renderAuthView();
        }

    } catch (error) {
        console.error("Blackwood Circle initialisation failed:", error);
        renderErrorState("The Blackwood Circle could not be opened. Please refresh and try again.");
    }
}

// =========================
// SUPABASE LOADER
// =========================

function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        if (window.supabase && typeof window.supabase.createClient === "function") {
            resolve();
            return;
        }

        const existingScript = document.querySelector("script[data-blackwood-supabase]");

        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(), { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Supabase could not be loaded.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = BLACKWOOD_MEMBERS_CONFIG.supabaseCdn;
        script.async = true;
        script.defer = true;
        script.dataset.blackwoodSupabase = "true";

        script.onload = () => {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                resolve();
            } else {
                reject(new Error("Supabase loaded, but createClient was unavailable."));
            }
        };

        script.onerror = () => {
            reject(new Error("Supabase could not be loaded."));
        };

        document.head.appendChild(script);
    });
}

// =========================
// AUTH VIEWS
// =========================

function renderAuthView() {
    const app = BlackwoodMembersState.app;

    app.innerHTML = `
        <section class="circle-auth-shell" aria-labelledby="circle-auth-title">
            <div class="circle-auth-intro">
                <p class="circle-kicker">The Blackwood Circle</p>
                <h1 id="circle-auth-title">Member Access</h1>
                <p>
                    Sign in to view your reader record, private Blackwood notes,
                    rewards, points, and members-only dispatches.
                </p>
            </div>

            <div class="circle-auth-card">
                <div class="circle-auth-tabs" role="tablist" aria-label="Member access options">
                    <button
                        type="button"
                        class="circle-auth-tab ${BlackwoodMembersState.activeAuthMode === "signin" ? "is-active" : ""}"
                        data-auth-mode="signin"
                    >
                        Sign in
                    </button>

                    <button
                        type="button"
                        class="circle-auth-tab ${BlackwoodMembersState.activeAuthMode === "signup" ? "is-active" : ""}"
                        data-auth-mode="signup"
                    >
                        Join the Circle
                    </button>
                </div>

                <form
                    id="circle-sign-in-form"
                    class="circle-auth-form"
                    ${BlackwoodMembersState.activeAuthMode === "signin" ? "" : "hidden"}
                    novalidate
                >
                    <label>
                        Email address
                        <input
                            type="email"
                            id="circle-sign-in-email"
                            autocomplete="email"
                            required
                        >
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            id="circle-sign-in-password"
                            autocomplete="current-password"
                            required
                        >
                    </label>

                    <button type="submit" class="button copper">
                        Enter the Circle
                    </button>
                </form>

                <form
                    id="circle-sign-up-form"
                    class="circle-auth-form"
                    ${BlackwoodMembersState.activeAuthMode === "signup" ? "" : "hidden"}
                    novalidate
                >
                    <label>
                        Display name
                        <input
                            type="text"
                            id="circle-sign-up-name"
                            autocomplete="name"
                            required
                        >
                    </label>

                    <label>
                        Email address
                        <input
                            type="email"
                            id="circle-sign-up-email"
                            autocomplete="email"
                            required
                        >
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            id="circle-sign-up-password"
                            autocomplete="new-password"
                            minlength="8"
                            required
                        >
                    </label>

                    <button type="submit" class="button copper">
                        Create Member Record
                    </button>
                </form>

                <p class="circle-auth-status" id="circle-auth-status" aria-live="polite"></p>
            </div>
        </section>
    `;

    bindAuthEvents();
}

function bindAuthEvents() {
    document.querySelectorAll("[data-auth-mode]").forEach(button => {
        button.addEventListener("click", () => {
            BlackwoodMembersState.activeAuthMode = button.dataset.authMode || "signin";
            renderAuthView();
        });
    });

    const signInForm = document.getElementById("circle-sign-in-form");
    const signUpForm = document.getElementById("circle-sign-up-form");

    if (signInForm) {
        signInForm.addEventListener("submit", handleMemberSignIn);
    }

    if (signUpForm) {
        signUpForm.addEventListener("submit", handleMemberSignUp);
    }
}

async function handleMemberSignIn(event) {
    event.preventDefault();

    const email = getInputValue("circle-sign-in-email");
    const password = getInputValue("circle-sign-in-password");

    if (!isValidEmail(email)) {
        setAuthStatus("Please enter a valid email address.", "is-error");
        return;
    }

    if (!password) {
        setAuthStatus("Please enter your password.", "is-error");
        return;
    }

    setAuthStatus("Checking your member record...", "is-loading");

    try {
        const { data, error } = await BlackwoodMembersState.client.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        BlackwoodMembersState.session = data.session || null;

        if (!BlackwoodMembersState.session) {
            setAuthStatus("Please check your email before signing in.", "is-error");
            return;
        }

        await loadMemberDashboard();

    } catch (error) {
        console.error("Blackwood Circle sign in failed:", error);
        setAuthStatus(cleanSupabaseError(error.message), "is-error");
    }
}

async function handleMemberSignUp(event) {
    event.preventDefault();

    const displayName = getInputValue("circle-sign-up-name");
    const email = getInputValue("circle-sign-up-email");
    const password = getInputValue("circle-sign-up-password");

    if (!displayName) {
        setAuthStatus("Please enter a display name.", "is-error");
        return;
    }

    if (!isValidEmail(email)) {
        setAuthStatus("Please enter a valid email address.", "is-error");
        return;
    }

    if (password.length < 8) {
        setAuthStatus("Please use a password of at least 8 characters.", "is-error");
        return;
    }

    setAuthStatus("Creating your Blackwood member record...", "is-loading");

    try {
        const { data, error } = await BlackwoodMembersState.client.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: getMembersRedirectUrl(),
                data: {
                    display_name: displayName,
                    reader_name: displayName
                }
            }
        });

        if (error) {
            throw error;
        }

        if (data.session) {
            BlackwoodMembersState.session = data.session;
            await loadMemberDashboard();
            return;
        }

        setAuthStatus(
            "Almost there. Please check your inbox and confirm your email address before signing in.",
            "is-success"
        );

    } catch (error) {
        console.error("Blackwood Circle sign up failed:", error);
        setAuthStatus(cleanSupabaseError(error.message), "is-error");
    }
}

async function handleMemberSignOut() {
    setDashboardStatus("Signing out...", "is-loading");

    try {
        const { error } = await BlackwoodMembersState.client.auth.signOut();

        if (error) {
            throw error;
        }

        BlackwoodMembersState.session = null;
        BlackwoodMembersState.member = null;
        BlackwoodMembersState.posts = [];
        BlackwoodMembersState.rewards = [];
        BlackwoodMembersState.points = [];

        renderAuthView();

    } catch (error) {
        console.error("Blackwood Circle sign out failed:", error);
        setDashboardStatus("Sign out failed. Please try again.", "is-error");
    }
}

// =========================
// DASHBOARD
// =========================

async function loadMemberDashboard() {
    if (!BlackwoodMembersState.session || !BlackwoodMembersState.session.user) {
        renderAuthView();
        return;
    }

    renderLoadingState("Retrieving your reader record...");

    try {
        const user = BlackwoodMembersState.session.user;

        const [
            profileResult,
            postsResult,
            rewardsResult,
            pointsResult
        ] = await Promise.all([
            BlackwoodMembersState.client
                .from("member_profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle(),

            BlackwoodMembersState.client
                .from("member_posts")
                .select("*")
                .eq("is_published", true)
                .order("published_at", { ascending: false }),

            BlackwoodMembersState.client
                .from("member_rewards")
                .select("*")
                .eq("is_active", true)
                .order("points_required", { ascending: true }),

            BlackwoodMembersState.client
                .from("member_points")
                .select("*")
                .eq("member_id", user.id)
                .order("created_at", { ascending: false })
        ]);

        if (profileResult.error) throw profileResult.error;
        if (postsResult.error) throw postsResult.error;
        if (rewardsResult.error) throw rewardsResult.error;
        if (pointsResult.error) throw pointsResult.error;

        BlackwoodMembersState.member = profileResult.data || buildFallbackProfile(user);
        BlackwoodMembersState.posts = postsResult.data || [];
        BlackwoodMembersState.rewards = rewardsResult.data || [];
        BlackwoodMembersState.points = pointsResult.data || [];

        renderDashboard();

    } catch (error) {
        console.error("Blackwood Circle dashboard failed:", error);
        renderErrorState("Your member record could not be loaded. Please refresh and try again.");
    }
}

function renderDashboard() {
    const app = BlackwoodMembersState.app;
    const member = BlackwoodMembersState.member || {};
    const pointsFromHistory = BlackwoodMembersState.points.reduce((total, item) => {
        return total + Number(item.points || 0);
    }, 0);

    const pointsTotal = Number(member.points_total || 0) || pointsFromHistory;
    const displayName = member.display_name || member.reader_name || member.email || "Reader";
    const tier = member.member_tier || "Reader";
    const status = member.member_status || "active";
    const arcLabel = member.is_arc_member ? "ARC Team Member" : "Circle Member";

    app.innerHTML = `
        <section class="circle-dashboard" id="circle-dashboard">
            <div class="circle-dashboard-hero">
                <p class="circle-kicker">The Blackwood Circle</p>
                <h1>Welcome back, ${escapeHtml(displayName)}</h1>
                <p>
                    Your private reader record, behind-the-scenes notes, rewards,
                    and Blackwood dispatches are gathered here.
                </p>
            </div>

            <div class="circle-dashboard-grid">
                <article class="circle-stat-card">
                    <span class="circle-stat-label">Member Tier</span>
                    <strong>${escapeHtml(tier)}</strong>
                </article>

                <article class="circle-stat-card">
                    <span class="circle-stat-label">Points</span>
                    <strong>${pointsTotal}</strong>
                </article>

                <article class="circle-stat-card">
                    <span class="circle-stat-label">Status</span>
                    <strong>${escapeHtml(capitalise(status))}</strong>
                </article>

                <article class="circle-stat-card">
                    <span class="circle-stat-label">Access</span>
                    <strong>${escapeHtml(arcLabel)}</strong>
                </article>
            </div>

            <div class="circle-dashboard-actions">
                <button type="button" class="button copper" id="circle-refresh-dashboard">
                    Refresh Record
                </button>

                <button type="button" class="button ghost" id="circle-sign-out">
                    Sign Out
                </button>

                <p class="circle-dashboard-status" id="circle-dashboard-status" aria-live="polite"></p>
            </div>

            <section class="circle-section" aria-labelledby="circle-profile-title">
                <h2 id="circle-profile-title">Your Reader Record</h2>

                <form id="circle-profile-form" class="circle-profile-form" novalidate>
                    <label>
                        Display name
                        <input
                            type="text"
                            id="circle-profile-display-name"
                            value="${escapeAttribute(member.display_name || "")}"
                        >
                    </label>

                    <label>
                        Reader name
                        <input
                            type="text"
                            id="circle-profile-reader-name"
                            value="${escapeAttribute(member.reader_name || "")}"
                        >
                    </label>

                    <button type="submit" class="button copper">
                        Save Reader Record
                    </button>
                </form>
            </section>

            <section class="circle-section" aria-labelledby="circle-posts-title">
                <h2 id="circle-posts-title">Behind the Files</h2>
                <div class="circle-post-list">
                    ${renderPosts()}
                </div>
            </section>

            <section class="circle-section" aria-labelledby="circle-rewards-title">
                <h2 id="circle-rewards-title">Rewards</h2>
                <div class="circle-reward-list">
                    ${renderRewards(pointsTotal)}
                </div>
            </section>

            <section class="circle-section" aria-labelledby="circle-points-title">
                <h2 id="circle-points-title">Points History</h2>
                <div class="circle-points-list">
                    ${renderPointsHistory()}
                </div>
            </section>
        </section>
    `;

    bindDashboardEvents();
}

function renderPosts() {
    if (!BlackwoodMembersState.posts.length) {
        return `
            <article class="circle-empty-card">
                <p>No Blackwood Circle posts are available yet.</p>
            </article>
        `;
    }

    return BlackwoodMembersState.posts.map(post => {
        const publishedDate = post.published_at
            ? formatDate(post.published_at)
            : "Filed in the archive";

        return `
            <article class="circle-post-card">
                <p class="circle-post-meta">
                    ${escapeHtml(post.category || "Behind the Files")} · ${escapeHtml(publishedDate)}
                </p>

                <h3>${escapeHtml(post.title)}</h3>

                ${post.excerpt ? `<p class="circle-post-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}

                <div class="circle-post-body">
                    ${formatPlainTextAsHtml(post.body)}
                </div>
            </article>
        `;
    }).join("");
}

function renderRewards(pointsTotal) {
    if (!BlackwoodMembersState.rewards.length) {
        return `
            <article class="circle-empty-card">
                <p>No rewards have been filed yet.</p>
            </article>
        `;
    }

    return BlackwoodMembersState.rewards.map(reward => {
        const required = Number(reward.points_required || 0);
        const unlocked = pointsTotal >= required;

        return `
            <article class="circle-reward-card ${unlocked ? "is-unlocked" : "is-locked"}">
                <p class="circle-reward-status">
                    ${unlocked ? "Unlocked" : `${required - pointsTotal} points to unlock`}
                </p>

                <h3>${escapeHtml(reward.title)}</h3>

                <p>${escapeHtml(reward.description || "")}</p>

                <small>
                    Requires ${required} points · ${escapeHtml(reward.required_tier || "Reader")}
                </small>
            </article>
        `;
    }).join("");
}

function renderPointsHistory() {
    if (!BlackwoodMembersState.points.length) {
        return `
            <article class="circle-empty-card">
                <p>No points have been recorded yet.</p>
                <p>Points and rewards will be added in a later phase.</p>
            </article>
        `;
    }

    return BlackwoodMembersState.points.map(point => {
        const points = Number(point.points || 0);
        const prefix = points >= 0 ? "+" : "";

        return `
            <article class="circle-points-card">
                <strong>${prefix}${points} points</strong>
                <p>${escapeHtml(point.reason || "Blackwood Circle activity")}</p>
                <small>${escapeHtml(formatDate(point.created_at))}</small>
            </article>
        `;
    }).join("");
}

function bindDashboardEvents() {
    const signOutButton = document.getElementById("circle-sign-out");
    const refreshButton = document.getElementById("circle-refresh-dashboard");
    const profileForm = document.getElementById("circle-profile-form");

    if (signOutButton) {
        signOutButton.addEventListener("click", handleMemberSignOut);
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", loadMemberDashboard);
    }

    if (profileForm) {
        profileForm.addEventListener("submit", handleProfileSave);
    }
}

async function handleProfileSave(event) {
    event.preventDefault();

    if (!BlackwoodMembersState.session || !BlackwoodMembersState.session.user) {
        setDashboardStatus("Please sign in again.", "is-error");
        return;
    }

    const displayName = getInputValue("circle-profile-display-name");
    const readerName = getInputValue("circle-profile-reader-name");

    if (!displayName && !readerName) {
        setDashboardStatus("Please enter at least one name.", "is-error");
        return;
    }

    setDashboardStatus("Saving your reader record...", "is-loading");

    try {
        const userId = BlackwoodMembersState.session.user.id;

        const { error } = await BlackwoodMembersState.client
            .from("member_profiles")
            .update({
                display_name: displayName,
                reader_name: readerName
            })
            .eq("id", userId);

        if (error) {
            throw error;
        }

        setDashboardStatus("Reader record saved.", "is-success");

        await loadMemberDashboard();

    } catch (error) {
        console.error("Profile save failed:", error);
        setDashboardStatus("Your reader record could not be saved.", "is-error");
    }
}

// =========================
// RENDER HELPERS
// =========================

function renderLoadingState(message) {
    BlackwoodMembersState.app.innerHTML = `
        <section class="circle-loading">
            <p class="circle-kicker">The Blackwood Circle</p>
            <h1>${escapeHtml(message)}</h1>
        </section>
    `;
}

function renderErrorState(message) {
    BlackwoodMembersState.app.innerHTML = `
        <section class="circle-error">
            <p class="circle-kicker">The Blackwood Circle</p>
            <h1>Something went wrong</h1>
            <p>${escapeHtml(message)}</p>
            <button type="button" class="button copper" onclick="window.location.reload()">
                Refresh Page
            </button>
        </section>
    `;
}

function setAuthStatus(message, className) {
    const status = document.getElementById("circle-auth-status");

    if (!status) return;

    status.textContent = message;
    status.classList.remove("is-success", "is-error", "is-loading");

    if (className) {
        status.classList.add(className);
    }
}

function setDashboardStatus(message, className) {
    const status = document.getElementById("circle-dashboard-status");

    if (!status) return;

    status.textContent = message;
    status.classList.remove("is-success", "is-error", "is-loading");

    if (className) {
        status.classList.add(className);
    }
}

function buildFallbackProfile(user) {
    return {
        id: user.id,
        email: user.email || "",
        display_name: user.user_metadata && user.user_metadata.display_name
            ? user.user_metadata.display_name
            : "",
        reader_name: user.user_metadata && user.user_metadata.reader_name
            ? user.user_metadata.reader_name
            : "",
        member_status: "active",
        member_tier: "Reader",
        points_total: 0,
        is_arc_member: false
    };
}

function formatPlainTextAsHtml(value) {
    const text = escapeHtml(value || "");

    if (!text) return "";

    return text
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function getMembersRedirectUrl() {
    return `${window.location.origin}${BLACKWOOD_MEMBERS_CONFIG.membersPagePath}`;
}

function getInputValue(id) {
    const input = document.getElementById(id);

    return input ? String(input.value || "").trim() : "";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function cleanSupabaseError(message) {
    const cleaned = String(message || "").trim();

    if (!cleaned) {
        return "Something went wrong. Please try again.";
    }

    if (/invalid login credentials/i.test(cleaned)) {
        return "Those login details were not recognised.";
    }

    if (/email not confirmed/i.test(cleaned)) {
        return "Please confirm your email address before signing in.";
    }

    if (/user already registered/i.test(cleaned)) {
        return "That email address already has a Blackwood Circle account.";
    }

    return cleaned;
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function capitalise(value) {
    const text = String(value || "").trim();

    if (!text) return "";

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}
