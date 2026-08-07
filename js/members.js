// =========================
// BLACKWOOD CIRCLE MEMBERS
// Supabase Auth + Member Dashboard + Rewards Redemption + Password Reset
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
    redemptions: [],
    activeAuthMode: "signin",
    isLoading: false,
    isRedeeming: false,
    isPasswordRecovery: false
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

        BlackwoodMembersState.client.auth.onAuthStateChange((event, session) => {
            BlackwoodMembersState.session = session || null;

            if (event === "PASSWORD_RECOVERY" || (session && isPasswordResetRoute())) {
                BlackwoodMembersState.isPasswordRecovery = true;
                renderPasswordUpdateView();
                return;
            }

            if (BlackwoodMembersState.session) {
                loadMemberDashboard();
            } else {
                renderAuthView();
            }
        });

        const { data, error } = await BlackwoodMembersState.client.auth.getSession();

        if (error) {
            throw error;
        }

        BlackwoodMembersState.session = data.session || null;

        if (BlackwoodMembersState.session && isPasswordResetRoute()) {
            BlackwoodMembersState.isPasswordRecovery = true;
            renderPasswordUpdateView();
            return;
        }

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

                    <button type="submit" class="circle-button circle-button-primary">
                        Enter the Circle
                    </button>

                    <button type="button" class="circle-button circle-button-secondary" id="circle-forgot-password-button">
                        Forgotten your password?
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

                    <button type="submit" class="circle-button circle-button-primary">
                        Create Member Record
                    </button>
                </form>

                <form
                    id="circle-password-reset-request-form"
                    class="circle-auth-form"
                    ${BlackwoodMembersState.activeAuthMode === "reset" ? "" : "hidden"}
                    novalidate
                >
                    <p>
                        Enter your Blackwood Circle email address and we’ll send you a secure password reset link.
                    </p>

                    <label>
                        Email address
                        <input
                            type="email"
                            id="circle-password-reset-email"
                            autocomplete="email"
                            required
                        >
                    </label>

                    <button type="submit" class="circle-button circle-button-primary">
                        Send Reset Link
                    </button>

                    <button type="button" class="circle-button circle-button-secondary" id="circle-back-to-signin-button">
                        Back to Sign In
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
    const resetRequestForm = document.getElementById("circle-password-reset-request-form");
    const forgotPasswordButton = document.getElementById("circle-forgot-password-button");
    const backToSignInButton = document.getElementById("circle-back-to-signin-button");

    if (signInForm) {
        signInForm.addEventListener("submit", handleMemberSignIn);
    }

    if (signUpForm) {
        signUpForm.addEventListener("submit", handleMemberSignUp);
    }

    if (resetRequestForm) {
        resetRequestForm.addEventListener("submit", handlePasswordResetRequest);
    }

    if (forgotPasswordButton) {
        forgotPasswordButton.addEventListener("click", () => {
            BlackwoodMembersState.activeAuthMode = "reset";
            renderAuthView();
        });
    }

    if (backToSignInButton) {
        backToSignInButton.addEventListener("click", () => {
            BlackwoodMembersState.activeAuthMode = "signin";
            renderAuthView();
        });
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

async function handlePasswordResetRequest(event) {
    event.preventDefault();

    const email = getInputValue("circle-password-reset-email");

    if (!isValidEmail(email)) {
        setAuthStatus("Please enter a valid email address.", "is-error");
        return;
    }

    setAuthStatus("Sending password reset link...", "is-loading");

    try {
        const { error } = await BlackwoodMembersState.client.auth.resetPasswordForEmail(email, {
            redirectTo: getPasswordResetRedirectUrl()
        });

        if (error) {
            throw error;
        }

        setAuthStatus(
            "Check your inbox. If that email has a Blackwood Circle account, a reset link has been sent.",
            "is-success"
        );
    } catch (error) {
        console.error("Password reset request failed:", error);
        setAuthStatus(cleanSupabaseError(error.message), "is-error");
    }
}

function renderPasswordUpdateView() {
    const app = BlackwoodMembersState.app;

    app.innerHTML = `
        <section class="circle-auth-shell" aria-labelledby="circle-password-update-title">
            <div class="circle-auth-intro">
                <p class="circle-kicker">The Blackwood Circle</p>
                <h1 id="circle-password-update-title">Set a New Password</h1>
                <p>
                    Choose a new password for your Blackwood Circle account.
                </p>
            </div>

            <div class="circle-auth-card">
                <form id="circle-password-update-form" class="circle-auth-form" novalidate>
                    <label>
                        New password
                        <input
                            type="password"
                            id="circle-new-password"
                            autocomplete="new-password"
                            minlength="8"
                            required
                        >
                    </label>

                    <label>
                        Confirm new password
                        <input
                            type="password"
                            id="circle-confirm-new-password"
                            autocomplete="new-password"
                            minlength="8"
                            required
                        >
                    </label>

                    <button type="submit" class="circle-button circle-button-primary">
                        Update Password
                    </button>
                </form>

                <p class="circle-auth-status" id="circle-auth-status" aria-live="polite"></p>
            </div>
        </section>
    `;

    const form = document.getElementById("circle-password-update-form");

    if (form) {
        form.addEventListener("submit", handlePasswordUpdate);
    }
}

async function handlePasswordUpdate(event) {
    event.preventDefault();

    const password = getInputValue("circle-new-password");
    const confirmPassword = getInputValue("circle-confirm-new-password");

    if (password.length < 8) {
        setAuthStatus("Please use a password of at least 8 characters.", "is-error");
        return;
    }

    if (password !== confirmPassword) {
        setAuthStatus("The passwords do not match.", "is-error");
        return;
    }

    setAuthStatus("Updating your password...", "is-loading");

    try {
        const { error } = await BlackwoodMembersState.client.auth.updateUser({
            password
        });

        if (error) {
            throw error;
        }

        BlackwoodMembersState.isPasswordRecovery = false;

        window.history.replaceState(
            {},
            document.title,
            BLACKWOOD_MEMBERS_CONFIG.membersPagePath
        );

        setAuthStatus("Password updated. Opening your member record...", "is-success");

        await loadMemberDashboard();
    } catch (error) {
        console.error("Password update failed:", error);
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
        BlackwoodMembersState.redemptions = [];

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
            pointsResult,
            redemptionsResult
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
                .order("created_at", { ascending: false }),

            BlackwoodMembersState.client
                .from("member_redemptions")
                .select("*")
                .eq("member_id", user.id)
                .order("created_at", { ascending: false })
        ]);

        if (profileResult.error) throw profileResult.error;
        if (postsResult.error) throw postsResult.error;
        if (rewardsResult.error) throw rewardsResult.error;
        if (pointsResult.error) throw pointsResult.error;
        if (redemptionsResult.error) throw redemptionsResult.error;

        BlackwoodMembersState.member = profileResult.data || buildFallbackProfile(user);
        BlackwoodMembersState.posts = postsResult.data || [];
        BlackwoodMembersState.rewards = rewardsResult.data || [];
        BlackwoodMembersState.points = pointsResult.data || [];
        BlackwoodMembersState.redemptions = redemptionsResult.data || [];

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

    const profilePoints = Number(member.points_total);
    const pointsTotal = Number.isFinite(profilePoints) ? profilePoints : pointsFromHistory;

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
                <button type="button" class="circle-button circle-button-primary" id="circle-refresh-dashboard">
                    Refresh Record
                </button>

                <button type="button" class="circle-button circle-button-secondary" id="circle-sign-out">
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

                    <button type="submit" class="circle-button circle-button-primary">
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

            <section class="circle-section" aria-labelledby="circle-redemptions-title">
                <h2 id="circle-redemptions-title">Redemptions</h2>
                <div class="circle-redemption-list">
                    ${renderRedemptions()}
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
        const rewardId = Number(reward.id);
        const required = Number(reward.points_required || 0);
        const unlocked = pointsTotal >= required;
        const isRedeemable = reward.is_redeemable === true;
        const latestRedemption = getLatestRedemptionForReward(rewardId);
        const activeRedemption = isActiveRedemption(latestRedemption);
        const canRedeem = isRedeemable && unlocked && !activeRedemption;

        return `
            <article class="circle-reward-card ${unlocked ? "is-unlocked" : "is-locked"} ${isRedeemable ? "is-redeemable" : ""}">
                <p class="circle-reward-status">
                    ${renderRewardStatusText(unlocked, required, pointsTotal, latestRedemption)}
                </p>

                <h3>${escapeHtml(reward.title)}</h3>

                <p>${escapeHtml(reward.description || "")}</p>

                <small>
                    Requires ${required} points · ${escapeHtml(reward.required_tier || "Reader")}
                </small>

                ${renderRewardAction(reward, canRedeem, latestRedemption)}
            </article>
        `;
    }).join("");
}

function renderRewardStatusText(unlocked, required, pointsTotal, latestRedemption) {
    const latestStatus = latestRedemption
        ? String(latestRedemption.status || "").toLowerCase()
        : "";

    if (latestStatus === "pending") {
        return "Pending";
    }

    if (unlocked && ["issued", "used", "cancelled"].includes(latestStatus)) {
        return "Unlocked again";
    }

    if (latestStatus === "issued") {
        return "Issued";
    }

    if (latestStatus === "used") {
        return "Used";
    }

    if (latestStatus === "cancelled") {
        return "Cancelled";
    }

    if (unlocked) {
        return "Unlocked";
    }

    return `${required - pointsTotal} points to unlock`;
}

function renderRewardAction(reward, canRedeem, latestRedemption) {
    const isRedeemable = reward.is_redeemable === true;

    if (!isRedeemable) {
        return "";
    }

    const latestStatus = latestRedemption
        ? String(latestRedemption.status || "").toLowerCase()
        : "";

    if (latestStatus === "pending") {
        return `
            <div class="circle-redemption-notice is-pending">
                <strong>Redemption requested</strong>
                <p>Your discount code will be issued manually and shown here once ready.</p>
            </div>
        `;
    }

    let existingRedemptionNotice = "";

    if (latestStatus === "issued") {
        existingRedemptionNotice = `
            <div class="circle-redemption-notice is-issued">
                <strong>Previous discount code issued</strong>
                ${latestRedemption.discount_code ? `
                    <div class="circle-redemption-code">
                        <span>Your code</span>
                        <code>${escapeHtml(latestRedemption.discount_code)}</code>
                    </div>
                ` : `
                    <p>Your discount code has been issued and will appear here shortly.</p>
                `}
            </div>
        `;
    }

    if (latestStatus === "used") {
        existingRedemptionNotice = `
            <div class="circle-redemption-notice is-used">
                <strong>Previous reward used</strong>
                <p>This redemption has already been used.</p>
            </div>
        `;
    }

    if (latestStatus === "cancelled") {
        existingRedemptionNotice = `
            <div class="circle-redemption-notice is-cancelled">
                <strong>Previous redemption cancelled</strong>
                <p>This redemption is no longer active.</p>
            </div>
        `;
    }

    if (!canRedeem) {
        return existingRedemptionNotice;
    }

    return `
        ${existingRedemptionNotice}

        <button
            type="button"
            class="circle-button circle-button-primary circle-redeem-button"
            data-redeem-reward-id="${Number(reward.id)}"
            data-reward-title="${escapeAttribute(reward.title || "this reward")}"
            data-points-cost="${Number(reward.points_required || 0)}"
        >
            Redeem Reward
        </button>
    `;
}

function renderRedemptions() {
    if (!BlackwoodMembersState.redemptions.length) {
        return `
            <article class="circle-empty-card">
                <p>No rewards have been redeemed yet.</p>
                <p>Unlocked rewards can be requested from the Rewards section above.</p>
            </article>
        `;
    }

    return BlackwoodMembersState.redemptions.map(redemption => {
        const status = capitalise(redemption.status || "pending");
        const requestedDate = redemption.requested_at
            ? formatDate(redemption.requested_at)
            : formatDate(redemption.created_at);

        return `
            <article class="circle-redemption-card">
                <p class="circle-post-meta">
                    ${escapeHtml(status)} · ${escapeHtml(requestedDate)}
                </p>

                <h3>${escapeHtml(redemption.reward_title || "Blackwood Circle reward")}</h3>

                <p>
                    ${Number(redemption.points_cost || 0)} points redeemed.
                </p>

                ${redemption.discount_code ? `
                    <div class="circle-redemption-code">
                        <span>Discount code</span>
                        <code>${escapeHtml(redemption.discount_code)}</code>
                    </div>
                ` : `
                    <p class="circle-muted-line">
                        Discount code pending manual issue.
                    </p>
                `}
            </article>
        `;
    }).join("");
}

function renderPointsHistory() {
    if (!BlackwoodMembersState.points.length) {
        return `
            <article class="circle-empty-card">
                <p>No points have been recorded yet.</p>
                <p>Points and rewards will appear here once your reader activity begins.</p>
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

    document.querySelectorAll("[data-redeem-reward-id]").forEach(button => {
        button.addEventListener("click", handleRewardRedemption);
    });
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

        await loadMemberDashboard();
        setDashboardStatus("Reader record saved.", "is-success");
    } catch (error) {
        console.error("Profile save failed:", error);
        setDashboardStatus("Your reader record could not be saved.", "is-error");
    }
}

async function handleRewardRedemption(event) {
    const button = event.currentTarget;
    const rewardId = Number(button.dataset.redeemRewardId || 0);
    const rewardTitle = button.dataset.rewardTitle || "this reward";
    const pointsCost = Number(button.dataset.pointsCost || 0);

    if (!rewardId) {
        setDashboardStatus("This reward could not be redeemed.", "is-error");
        return;
    }

    const confirmed = window.confirm(
        `Redeem "${rewardTitle}" for ${pointsCost} points?\n\nYour points will be deducted and the discount code will be issued manually.`
    );

    if (!confirmed) {
        return;
    }

    if (BlackwoodMembersState.isRedeeming) {
        return;
    }

    BlackwoodMembersState.isRedeeming = true;
    button.disabled = true;
    button.textContent = "Requesting...";

    setDashboardStatus("Requesting reward redemption...", "is-loading");

    try {
        const { error } = await BlackwoodMembersState.client.rpc(
            "request_member_reward_redemption",
            {
                p_reward_id: rewardId
            }
        );

        if (error) {
            throw error;
        }

        await loadMemberDashboard();

        setDashboardStatus(
            "Reward requested. Your discount code will be issued manually.",
            "is-success"
        );
    } catch (error) {
        console.error("Reward redemption failed:", error);
        setDashboardStatus(cleanSupabaseError(error.message), "is-error");

        button.disabled = false;
        button.textContent = "Redeem Reward";
    } finally {
        BlackwoodMembersState.isRedeeming = false;
    }
}

// =========================
// REDEMPTION HELPERS
// =========================

function getLatestRedemptionForReward(rewardId) {
    return BlackwoodMembersState.redemptions.find(redemption => {
        return Number(redemption.reward_id) === Number(rewardId);
    }) || null;
}

function isActiveRedemption(redemption) {
    if (!redemption) {
        return false;
    }

    return String(redemption.status || "").toLowerCase() === "pending";
}

// =========================
// PASSWORD RESET HELPERS
// =========================

function getPasswordResetRedirectUrl() {
    return `${window.location.origin}${BLACKWOOD_MEMBERS_CONFIG.membersPagePath}?reset-password=1`;
}

function isPasswordResetRoute() {
    const search = String(window.location.search || "").toLowerCase();
    const hash = String(window.location.hash || "").toLowerCase();

    return (
        search.includes("reset-password=1") ||
        search.includes("type=recovery") ||
        hash.includes("type=recovery")
    );
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
            <button type="button" class="circle-button circle-button-primary" onclick="window.location.reload()">
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

    if (/not available for redemption/i.test(cleaned)) {
        return "This reward is not currently available for redemption.";
    }

    if (/not enough points/i.test(cleaned)) {
        return "You do not have enough points for this reward.";
    }

    if (/already have this reward/i.test(cleaned) || /pending redemption request/i.test(cleaned)) {
        return "You already have a pending redemption request for this reward.";
    }

    if (/password/i.test(cleaned) && /weak/i.test(cleaned)) {
        return "Please choose a stronger password.";
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
(function () {
    "use strict";

    const CONFIG = {
        supabaseUrl: "https://bmnlynjldlnxfvunqbqq.supabase.co",
        supabaseKey: "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",
        supabaseCdn: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    };

    let visibilityClient = null;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialiseMemberIntroVisibility);
    } else {
        initialiseMemberIntroVisibility();
    }

    async function initialiseMemberIntroVisibility() {
        if (!document.body.classList.contains("members-page")) {
            return;
        }

        try {
            await loadSupabaseLibrary();

            visibilityClient = window.supabase.createClient(
                CONFIG.supabaseUrl,
                CONFIG.supabaseKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );

            const { data, error } = await visibilityClient.auth.getSession();

            if (error) {
                throw error;
            }

            updateMemberIntroVisibility(data.session || null);

            visibilityClient.auth.onAuthStateChange(function (_event, session) {
                updateMemberIntroVisibility(session || null);
            });

        } catch (error) {
            console.warn("Member intro visibility check failed:", error);
            document.body.classList.remove("is-circle-signed-in");
            document.body.classList.add("is-circle-signed-out");
        }
    }

    function updateMemberIntroVisibility(session) {
        if (session && session.user) {
            document.body.classList.add("is-circle-signed-in");
            document.body.classList.remove("is-circle-signed-out");
            return;
        }

        document.body.classList.remove("is-circle-signed-in");
        document.body.classList.add("is-circle-signed-out");
    }

    function loadSupabaseLibrary() {
        return new Promise(function (resolve, reject) {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                resolve();
                return;
            }

            const existingScript = document.querySelector("script[data-members-visibility-supabase]");

            if (existingScript) {
                existingScript.addEventListener("load", function () {
                    resolve();
                }, { once: true });

                existingScript.addEventListener("error", function () {
                    reject(new Error("Supabase could not be loaded."));
                }, { once: true });

                return;
            }

            const script = document.createElement("script");
            script.src = CONFIG.supabaseCdn;
            script.async = true;
            script.defer = true;
            script.dataset.membersVisibilitySupabase = "true";

            script.onload = function () {
                if (window.supabase && typeof window.supabase.createClient === "function") {
                    resolve();
                    return;
                }

                reject(new Error("Supabase loaded, but createClient was unavailable."));
            };

            script.onerror = function () {
                reject(new Error("Supabase could not be loaded."));
            };

            document.head.appendChild(script);
        });
    }
})();
