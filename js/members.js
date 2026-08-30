// =========================
// BLACKWOOD CIRCLE MEMBERS
// Supabase Auth + Member Dashboard + Rewards Redemption + Password Reset
// Behind the Files carousel powered by /data/BFA.json
// Behind the Files reactions powered by Supabase
// ARC Profile powered by /js/member-arc-profile.js
// Blackwood Bookshelf powered by /js/member-bookshelf.js
// Phase 2A: Member Home Dashboard summary layer
// =========================

(function () {
    "use strict";

    const BLACKWOOD_MEMBERS_CONFIG = {
        supabaseUrl: "https://bmnlynjldlnxfvunqbqq.supabase.co",
        supabaseKey: "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",
        membersPagePath: "/pages/members.html",
        readerRecordsPagePath: "/pages/reader-records.html",
        behindFilesJsonPath: "/data/BFA.json",
        behindFilesFallbackImage: "/assets/ArchiveFilesBG.png",
        supabaseCdn: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    };

    const BLACKWOOD_BFA_REACTIONS = [
        {
            label: "Filed",
            description: "I read this file."
        },
        {
            label: "Haunting",
            description: "This stayed with me."
        },
        {
            label: "More Like This",
            description: "I want more of this."
        },
        {
            label: "Stayed With Me",
            description: "This left a mark."
        }
    ];

    const BlackwoodMembersState = {
        app: null,
        client: null,
        session: null,
        member: null,
        posts: [],
        behindFiles: [],
        behindFilesIndex: 0,
        postReactions: [],
        rewards: [],
        points: [],
        redemptions: [],
        arcAssignments: [],
        activeAuthMode: "signin",
        isRedeeming: false,
        isReactingToBehindFile: false,
        isPasswordRecovery: false,
        escapeListenerBound: false
    };

    document.addEventListener("DOMContentLoaded", function () {
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

            BlackwoodMembersState.client.auth.onAuthStateChange(function (event, session) {
                BlackwoodMembersState.session = session || null;
                updateMemberIntroVisibility(BlackwoodMembersState.session);

                if (event === "PASSWORD_RECOVERY" || (session && isPasswordResetRoute())) {
                    BlackwoodMembersState.isPasswordRecovery = true;
                    renderPasswordUpdateView();
                    return;
                }

                if (BlackwoodMembersState.session) {
                    loadMemberDashboard();
                    return;
                }

                renderAuthView();
            });

            const { data, error } = await BlackwoodMembersState.client.auth.getSession();

            if (error) {
                throw error;
            }

            BlackwoodMembersState.session = data.session || null;
            updateMemberIntroVisibility(BlackwoodMembersState.session);

            if (BlackwoodMembersState.session && isPasswordResetRoute()) {
                BlackwoodMembersState.isPasswordRecovery = true;
                renderPasswordUpdateView();
                return;
            }

            if (BlackwoodMembersState.session) {
                await loadMemberDashboard();
                return;
            }

            renderAuthView();

        } catch (error) {
            console.error("Blackwood Circle initialisation failed:", error);
            updateMemberIntroVisibility(null);
            renderErrorState("The Blackwood Circle could not be opened. Please refresh and try again.");
        }
    }

    // =========================
    // SIGNED-IN INTRO VISIBILITY
    // =========================

    function updateMemberIntroVisibility(session) {
        if (!document.body || !document.body.classList.contains("members-page")) {
            return;
        }

        if (session && session.user) {
            document.body.classList.add("is-circle-signed-in");
            document.body.classList.remove("is-circle-signed-out");
            return;
        }

        document.body.classList.remove("is-circle-signed-in");
        document.body.classList.add("is-circle-signed-out");
    }

    // =========================
    // SUPABASE LOADER
    // =========================

    function loadSupabaseLibrary() {
        return new Promise(function (resolve, reject) {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                resolve();
                return;
            }

            const existingScript = document.querySelector("script[data-blackwood-supabase]");

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
            script.src = BLACKWOOD_MEMBERS_CONFIG.supabaseCdn;
            script.async = true;
            script.defer = true;
            script.dataset.blackwoodSupabase = "true";

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

    // =========================
    // AUTH VIEWS
    // =========================

    function renderAuthView() {
        updateMemberIntroVisibility(null);

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
        document.querySelectorAll("[data-auth-mode]").forEach(function (button) {
            button.addEventListener("click", function () {
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
            forgotPasswordButton.addEventListener("click", function () {
                BlackwoodMembersState.activeAuthMode = "reset";
                renderAuthView();
            });
        }

        if (backToSignInButton) {
            backToSignInButton.addEventListener("click", function () {
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
            updateMemberIntroVisibility(BlackwoodMembersState.session);

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
                updateMemberIntroVisibility(BlackwoodMembersState.session);
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
        updateMemberIntroVisibility(BlackwoodMembersState.session);

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
            BlackwoodMembersState.behindFiles = [];
            BlackwoodMembersState.behindFilesIndex = 0;
            BlackwoodMembersState.postReactions = [];
            BlackwoodMembersState.rewards = [];
            BlackwoodMembersState.points = [];
            BlackwoodMembersState.redemptions = [];
            BlackwoodMembersState.arcAssignments = [];
            BlackwoodMembersState.isReactingToBehindFile = false;

            updateMemberIntroVisibility(null);
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

        updateMemberIntroVisibility(BlackwoodMembersState.session);
        renderLoadingState("Retrieving your reader record...");

        try {
            const user = BlackwoodMembersState.session.user;

            const [
                profileResult,
                legacyPosts,
                behindFiles,
                postReactions,
                rewardsResult,
                pointsResult,
                redemptionsResult,
                arcAssignments
            ] = await Promise.all([
                BlackwoodMembersState.client
                    .from("member_profiles")
                    .select("*")
                    .eq("id", user.id)
                    .maybeSingle(),

                loadLegacyMemberPosts(),

                loadBehindFilesPosts(),

                loadMemberPostReactions(),

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
                    .order("created_at", { ascending: false }),

                loadMemberArcAssignmentsForDashboard(user.id)
            ]);

            if (profileResult.error) throw profileResult.error;
            if (rewardsResult.error) throw rewardsResult.error;
            if (pointsResult.error) throw pointsResult.error;
            if (redemptionsResult.error) throw redemptionsResult.error;

            BlackwoodMembersState.member = profileResult.data || buildFallbackProfile(user);
            BlackwoodMembersState.posts = legacyPosts || [];
            BlackwoodMembersState.behindFiles = behindFiles || [];
            BlackwoodMembersState.behindFilesIndex = 0;
            BlackwoodMembersState.postReactions = postReactions || [];
            BlackwoodMembersState.rewards = rewardsResult.data || [];
            BlackwoodMembersState.points = pointsResult.data || [];
            BlackwoodMembersState.redemptions = redemptionsResult.data || [];
            BlackwoodMembersState.arcAssignments = arcAssignments || [];

            renderDashboard();

        } catch (error) {
            console.error("Blackwood Circle dashboard failed:", error);
            renderErrorState("Your member record could not be loaded. Please refresh and try again.");
        }
    }

    async function loadMemberArcAssignmentsForDashboard(memberId) {
        if (!memberId) {
            return [];
        }

        try {
            const { data, error } = await BlackwoodMembersState.client
                .from("arc_file_assignments")
                .select(`
                    id,
                    member_id,
                    arc_file_id,
                    application_id,
                    status,
                    review_due_date,
                    review_link,
                    download_count,
                    last_downloaded_at,
                    created_at,
                    arc_files (
                        title,
                        slug,
                        author_name
                    )
                `)
                .eq("member_id", memberId)
                .eq("status", "active")
                .order("created_at", { ascending: false });

            if (error) {
                console.warn("ARC assignments with file details could not be loaded:", error.message);
                return loadMemberArcAssignmentsFallback(memberId);
            }

            return Array.isArray(data) ? data : [];

        } catch (error) {
            console.warn("ARC assignments query failed:", error);
            return loadMemberArcAssignmentsFallback(memberId);
        }
    }

    async function loadMemberArcAssignmentsFallback(memberId) {
        try {
            const { data, error } = await BlackwoodMembersState.client
                .from("arc_file_assignments")
                .select("id,member_id,arc_file_id,application_id,status,review_due_date,review_link,download_count,last_downloaded_at,created_at")
                .eq("member_id", memberId)
                .eq("status", "active")
                .order("created_at", { ascending: false });

            if (error) {
                console.warn("ARC assignment fallback query failed:", error.message);
                return [];
            }

            return Array.isArray(data) ? data : [];

        } catch (error) {
            console.warn("ARC assignment fallback failed:", error);
            return [];
        }
    }

    async function loadLegacyMemberPosts() {
        try {
            const { data, error } = await BlackwoodMembersState.client
                .from("member_posts")
                .select("*")
                .eq("is_published", true)
                .order("published_at", { ascending: false });

            if (error) {
                console.warn("Legacy member_posts could not be loaded:", error.message);
                return [];
            }

            return Array.isArray(data) ? data : [];

        } catch (error) {
            console.warn("Legacy member_posts query failed:", error);
            return [];
        }
    }

    async function loadBehindFilesPosts() {
        try {
            const response = await fetch(
                `${BLACKWOOD_MEMBERS_CONFIG.behindFilesJsonPath}?cache=${Date.now()}`
            );

            if (!response.ok) {
                throw new Error("BFA.json could not be loaded.");
            }

            const data = await response.json();
            const posts = Array.isArray(data.posts) ? data.posts : [];

            return normaliseBehindFilesPosts(posts);

        } catch (error) {
            console.warn("Behind the Files JSON could not be loaded:", error);
            return [];
        }
    }

    async function loadMemberPostReactions() {
        if (!BlackwoodMembersState.session || !BlackwoodMembersState.session.user) {
            return [];
        }

        try {
            const { data, error } = await BlackwoodMembersState.client
                .from("member_post_reactions")
                .select("*")
                .eq("member_id", BlackwoodMembersState.session.user.id)
                .order("created_at", { ascending: false });

            if (error) {
                console.warn("Member post reactions could not be loaded:", error.message);
                return [];
            }

            return Array.isArray(data) ? data : [];

        } catch (error) {
            console.warn("Member post reactions query failed:", error);
            return [];
        }
    }

    function normaliseBehindFilesPosts(posts) {
        return posts
            .filter(function (post) {
                return post && post.published === true;
            })
            .map(function (post) {
                return {
                    id: String(post.id || createFallbackPostId(post)).trim(),
                    title: String(post.title || "Untitled File").trim(),
                    category: String(post.category || "Behind the Files").trim(),
                    excerpt: String(post.excerpt || "").trim(),
                    body: String(post.body || "").trim(),
                    image: String(post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage).trim(),
                    published: post.published === true,
                    pinned: post.pinned === true,
                    publishedAt: String(post.publishedAt || "").trim()
                };
            })
            .sort(sortBehindFilesPosts);
    }

    function sortBehindFilesPosts(a, b) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
    }

    function createFallbackPostId(post) {
        const title = String(post && post.title ? post.title : "behind-file")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48);

        const date = String(post && post.publishedAt ? post.publishedAt : "undated")
            .replace(/[^0-9]/g, "");

        return `bfa-${date || "undated"}-${title || "file"}`;
    }

    function renderDashboard() {
        const app = BlackwoodMembersState.app;
        const member = BlackwoodMembersState.member || {};

        const pointsFromHistory = BlackwoodMembersState.points.reduce(function (total, item) {
            return total + Number(item.points || 0);
        }, 0);

        const profilePoints = Number(member.points_total);
        const pointsTotal = Number.isFinite(profilePoints) ? profilePoints : pointsFromHistory;

        const displayName = member.display_name || member.reader_name || member.email || "Reader";
        const tier = member.member_tier || "Reader";
        const status = member.member_status || "active";
        const arcLabel = isArcMemberProfile(member) ? "ARC Team Member" : "Circle Member";

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

                ${renderMemberHomeDashboard(member, pointsTotal, {
                    displayName,
                    tier,
                    status,
                    arcLabel
                })}

                <div class="circle-dashboard-actions">
                    <button type="button" class="circle-button circle-button-primary" id="circle-refresh-dashboard">
                        Refresh Record
                    </button>

                    <button type="button" class="circle-button circle-button-secondary" id="circle-sign-out">
                        Sign Out
                    </button>

                    <p class="circle-dashboard-status" id="circle-dashboard-status" aria-live="polite"></p>
                </div>

                <section class="circle-reader-record-cta" aria-labelledby="circle-reader-record-cta-title">
                    <div>
                        <h2 id="circle-reader-record-cta-title">Leave a Reader Record</h2>
                        <p>
                            Finished a Blackwood title? Submit a reader record, share your review,
                            and earn Circle points when your record is approved.
                        </p>
                    </div>

                    <a 
                        href="${BLACKWOOD_MEMBERS_CONFIG.readerRecordsPagePath}" 
                        class="circle-reader-record-button"
                    >
                        Leave a Reader Record
                    </a>
                </section>

                ${renderArcProfileMount()}

                ${renderBookshelfMount()}

                ${renderBehindFilesCarousel()}

                <section class="circle-section" aria-labelledby="circle-rewards-title">
                    <h2 id="circle-rewards-title">Rewards</h2>
                    <div class="circle-reward-list">
                        ${renderRewards(pointsTotal)}
                    </div>
                </section>

                <section class="circle-section" aria-labelledby="circle-redemptions-title">
                    <h2 id="circle-redemptions-title">Redemptions</h2>
                    <div class="circle-reward-list">
                        ${renderRedemptions()}
                    </div>
                </section>

                <section 
                    class="circle-section circle-collapsible-section is-collapsed" 
                    aria-labelledby="circle-points-title"
                >
                    <div class="circle-section-toggle-header">
                        <h2 id="circle-points-title">Points History</h2>

                        <button 
                            type="button" 
                            class="circle-section-toggle-button" 
                            id="circle-points-history-toggle"
                            aria-expanded="false"
                            aria-controls="circle-points-history-content"
                        >
                            Show history
                        </button>
                    </div>

                    <div 
                        class="circle-collapsible-content" 
                        id="circle-points-history-content"
                    >
                        <div class="circle-points-list">
                            ${renderPointsHistory()}
                        </div>
                    </div>
                </section>
            </section>
        `;

        bindDashboardEvents();
    }

    function renderMemberHomeDashboard(member, pointsTotal, summary) {
        const arcSummary = getArcDashboardSummary(member);
        const rewardSummary = getRewardsDashboardSummary(pointsTotal);
        const redemptionSummary = getRedemptionDashboardSummary();
        const latestDispatch = getLatestBehindFile();
        const arcHref = isArcMemberProfile(member) ? "#blackwood-arc-profile-root" : "/pages/arc-team.html";
        const arcActionLabel = isArcMemberProfile(member) ? "Open ARC Vault" : "Apply for ARC Team";

        return `
            <section class="circle-home-dashboard" aria-labelledby="circle-home-dashboard-title">
                <div class="circle-home-main">
                    <div>
                        <p class="circle-kicker">Member Home</p>

                        <h2 id="circle-home-dashboard-title">
                            Your Circle
                        </h2>

                        <p>
                            A quick view of your points, ARC access, rewards, private dispatches,
                            and Blackwood reader activity.
                        </p>
                    </div>

                    <div class="circle-home-actions">
                        <a href="${escapeAttribute(arcHref)}" class="circle-button circle-button-primary">
                            ${escapeHtml(arcActionLabel)}
                        </a>

                        <a href="#circle-rewards-title" class="circle-button circle-button-secondary">
                            View Rewards
                        </a>

                        <a href="#circle-posts-title" class="circle-button circle-button-secondary">
                            Latest Dispatch
                        </a>

                        <a href="#blackwood-bookshelf-root" class="circle-button circle-button-secondary">
                            My Bookshelf
                        </a>
                    </div>
                </div>

                <div class="circle-dashboard-grid circle-home-stat-grid">
                    <article class="circle-stat-card">
                        <span class="circle-stat-label">Points</span>
                        <strong id="circle-home-points-total">${escapeHtml(String(pointsTotal))}</strong>
                        <small>Current Circle total</small>
                    </article>

                    <article class="circle-stat-card">
                        <span class="circle-stat-label">Member Tier</span>
                        <strong>${escapeHtml(summary.tier)}</strong>
                        <small>${escapeHtml(capitalise(summary.status))}</small>
                    </article>

                    <article class="circle-stat-card">
                        <span class="circle-stat-label">Access</span>
                        <strong>${escapeHtml(summary.arcLabel)}</strong>
                        <small>${escapeHtml(arcSummary.shortLine)}</small>
                    </article>

                    <article class="circle-stat-card">
                        <span class="circle-stat-label">Rewards</span>
                        <strong>${escapeHtml(rewardSummary.headline)}</strong>
                        <small>${escapeHtml(rewardSummary.detail)}</small>
                    </article>
                </div>

                <div class="circle-home-summary-grid">
                    <article class="circle-home-summary-card">
                        <span>ARC Desk</span>
                        <h3>${escapeHtml(arcSummary.headline)}</h3>
                        <p>${escapeHtml(arcSummary.detail)}</p>
                    </article>

                    <article class="circle-home-summary-card">
                        <span>Latest Dispatch</span>
                        <h3>${escapeHtml(latestDispatch.title)}</h3>
                        <p>${escapeHtml(latestDispatch.detail)}</p>
                    </article>

                    <article class="circle-home-summary-card">
                        <span>Reward Desk</span>
                        <h3>${escapeHtml(redemptionSummary.headline)}</h3>
                        <p>${escapeHtml(redemptionSummary.detail)}</p>
                    </article>
                </div>
            </section>
        `;
    }

    function getArcDashboardSummary(member) {
        const assignments = Array.isArray(BlackwoodMembersState.arcAssignments)
            ? BlackwoodMembersState.arcAssignments
            : [];

        const isArcMember = isArcMemberProfile(member);
        const activeAssignments = assignments.filter(function (assignment) {
            return String(assignment.status || "active").toLowerCase() === "active";
        });

        const reviewFiledCount = activeAssignments.filter(function (assignment) {
            return looksLikeUrl(assignment.review_link || "");
        }).length;

        const downloadedCount = activeAssignments.filter(function (assignment) {
            return Number(assignment.download_count || 0) > 0;
        }).length;

        const nextDueAssignment = activeAssignments
            .filter(function (assignment) {
                return Boolean(assignment.review_due_date);
            })
            .sort(function (a, b) {
                return String(a.review_due_date).localeCompare(String(b.review_due_date));
            })[0] || null;

        if (!isArcMember) {
            return {
                headline: "Not enrolled",
                shortLine: "Standard Circle access",
                detail: "ARC Team access has not been enabled for this member record yet."
            };
        }

        if (!activeAssignments.length) {
            return {
                headline: "ARC Team ready",
                shortLine: "No active ARC files",
                detail: "You are marked as an ARC Team member. New assignments will appear when issued."
            };
        }

        const activeLabel = activeAssignments.length === 1
            ? "1 active ARC"
            : `${activeAssignments.length} active ARCs`;

        const reviewLabel = reviewFiledCount === 1
            ? "1 review filed"
            : `${reviewFiledCount} reviews filed`;

        const downloadLabel = downloadedCount === 1
            ? "1 opened"
            : `${downloadedCount} opened`;

        const dueLine = nextDueAssignment
            ? `Next review due ${formatDate(nextDueAssignment.review_due_date)}.`
            : "No review due date recorded.";

        return {
            headline: activeLabel,
            shortLine: `${downloadLabel} · ${reviewLabel}`,
            detail: `${dueLine} ${downloadLabel}. ${reviewLabel}.`
        };
    }

    function getRewardsDashboardSummary(pointsTotal) {
        const rewards = Array.isArray(BlackwoodMembersState.rewards)
            ? BlackwoodMembersState.rewards
            : [];

        const unlockedRewards = rewards.filter(function (reward) {
            return pointsTotal >= Number(reward.points_required || 0);
        });

        const redeemableUnlockedRewards = unlockedRewards.filter(function (reward) {
            return reward.is_redeemable === true;
        });

        if (!rewards.length) {
            return {
                headline: "None filed",
                detail: "Rewards will appear once they are added to the Circle."
            };
        }

        if (!unlockedRewards.length) {
            const nextReward = rewards
                .slice()
                .sort(function (a, b) {
                    return Number(a.points_required || 0) - Number(b.points_required || 0);
                })[0];

            const pointsNeeded = Math.max(0, Number(nextReward.points_required || 0) - pointsTotal);

            return {
                headline: `${pointsNeeded} to unlock`,
                detail: "Next reward milestone"
            };
        }

        if (redeemableUnlockedRewards.length) {
            return {
                headline: `${redeemableUnlockedRewards.length} unlocked`,
                detail: "Redeemable reward available"
            };
        }

        return {
            headline: `${unlockedRewards.length} unlocked`,
            detail: "Reward milestone reached"
        };
    }

    function getRedemptionDashboardSummary() {
        const redemptions = Array.isArray(BlackwoodMembersState.redemptions)
            ? BlackwoodMembersState.redemptions
            : [];

        if (!redemptions.length) {
            return {
                headline: "No redemptions yet",
                detail: "Unlocked rewards can be requested from the Rewards section."
            };
        }

        const pending = redemptions.filter(function (redemption) {
            return String(redemption.status || "").toLowerCase() === "pending";
        });

        const issued = redemptions.filter(function (redemption) {
            return String(redemption.status || "").toLowerCase() === "issued";
        });

        const latestWithCode = redemptions.find(function (redemption) {
            return Boolean(redemption.discount_code);
        });

        if (pending.length) {
            return {
                headline: `${pending.length} pending`,
                detail: "A reward request is waiting to be issued."
            };
        }

        if (latestWithCode) {
            return {
                headline: "Code issued",
                detail: `${latestWithCode.reward_title || "Reward"} is available in your redemption history.`
            };
        }

        if (issued.length) {
            return {
                headline: `${issued.length} issued`,
                detail: "Issued rewards are listed in your redemption history."
            };
        }

        return {
            headline: `${redemptions.length} filed`,
            detail: "Your previous reward requests are listed below."
        };
    }

    function getLatestBehindFile() {
        const posts = getBehindFilesForDisplay();
        const post = posts[0] || null;

        if (!post) {
            return {
                title: "No dispatch filed",
                detail: "Private Blackwood dispatches will appear here once published."
            };
        }

        return {
            title: post.title || "Untitled Dispatch",
            detail: `${post.category || "Behind the Files"} · ${formatBehindFileDate(post.publishedAt)}`
        };
    }

    // =========================
    // ARC PROFILE
    // =========================

    function renderArcProfileMount() {
        const member = BlackwoodMembersState.member;

        if (!isArcMemberProfile(member)) {
            return "";
        }

        return `
            <section 
                class="circle-section member-arc-profile-section" 
                id="blackwood-arc-profile-root"
                aria-label="My ARC Profile"
            >
                <div class="circle-empty-card">
                    <p>Opening your ARC profile...</p>
                </div>
            </section>
        `;
    }

    function isArcMemberProfile(member) {
        if (!member) {
            return false;
        }

        return member.is_arc_member === true ||
            String(member.is_arc_member || "").toLowerCase() === "true";
    }

    function bindMemberArcProfile() {
        const root = document.getElementById("blackwood-arc-profile-root");

        if (!root || typeof window.initBlackwoodArcProfile !== "function") {
            return;
        }

        window.initBlackwoodArcProfile({
            root,
            session: BlackwoodMembersState.session
        });
    }

    // =========================
    // BLACKWOOD BOOKSHELF
    // =========================

    function renderBookshelfMount() {
        return `
            <section 
                class="circle-section blackwood-bookshelf-section" 
                id="blackwood-bookshelf-root"
                aria-label="My Blackwood Bookshelf"
            >
                <div class="circle-empty-card">
                    <p>Opening your Blackwood Bookshelf...</p>
                </div>
            </section>
        `;
    }

    function bindBlackwoodBookshelf() {
        const root = document.getElementById("blackwood-bookshelf-root");

        if (!root || typeof window.initBlackwoodBookshelf !== "function") {
            return;
        }

        window.initBlackwoodBookshelf({
            root,
            client: BlackwoodMembersState.client,
            session: BlackwoodMembersState.session
        });
    }

    // =========================
    // BEHIND THE FILES CAROUSEL
    // =========================

    function getBehindFilesForDisplay() {
        if (BlackwoodMembersState.behindFiles.length) {
            return BlackwoodMembersState.behindFiles;
        }

        return convertLegacyPostsToBehindFiles(BlackwoodMembersState.posts);
    }

    function convertLegacyPostsToBehindFiles(posts) {
        if (!Array.isArray(posts) || !posts.length) {
            return [];
        }

        return posts.map(function (post) {
            return {
                id: String(post.id || createFallbackPostId(post)),
                title: String(post.title || "Untitled File"),
                category: String(post.category || "Behind the Files"),
                excerpt: String(post.excerpt || ""),
                body: String(post.body || ""),
                image: String(post.image_url || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage),
                published: true,
                pinned: false,
                publishedAt: String(post.published_at || post.created_at || "")
            };
        });
    }

    function renderBehindFilesCarousel() {
        const posts = getBehindFilesForDisplay();

        if (!posts.length) {
            return `
                <section class="circle-section circle-bfa-section" aria-labelledby="circle-posts-title">
                    <div class="circle-bfa-section-heading">
                        <p class="circle-kicker">Private Dispatches</p>
                        <h2 id="circle-posts-title">Behind the Files</h2>
                        <p>
                            Weekly dispatches, production notes, release progress, and private Blackwood updates will appear here.
                        </p>
                    </div>

                    <article class="circle-empty-card">
                        <p>No Behind the Files updates have been filed yet.</p>
                    </article>
                </section>
            `;
        }

        BlackwoodMembersState.behindFilesIndex = clampBehindFilesIndex(
            BlackwoodMembersState.behindFilesIndex,
            posts
        );

        const post = posts[BlackwoodMembersState.behindFilesIndex];
        const hasMultiplePosts = posts.length > 1;

        return `
            <section class="circle-section circle-bfa-section" aria-labelledby="circle-posts-title">
                <div class="circle-bfa-section-heading">
                    <p class="circle-kicker">Private Dispatches</p>
                    <h2 id="circle-posts-title">Behind the Files</h2>
                    <p>
                        Weekly notes, production fragments, ARC notices, release progress,
                        and private updates from the Blackwood desk.
                    </p>
                </div>

                <article class="circle-bfa-carousel" id="circle-bfa-carousel">
                    <div class="circle-bfa-image-wrap">
                        <img
                            id="circle-bfa-image"
                            src="${escapeAttribute(post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage)}"
                            alt=""
                            loading="lazy"
                        >
                    </div>

                    <div class="circle-bfa-content">
                        <div class="circle-bfa-meta">
                            <span id="circle-bfa-category">${escapeHtml(post.category)}</span>
                            <span id="circle-bfa-date">${escapeHtml(formatBehindFileDate(post.publishedAt))}</span>
                            <span id="circle-bfa-pinned" ${post.pinned ? "" : "hidden"}>Pinned</span>
                        </div>

                        <h3 id="circle-bfa-title">${escapeHtml(post.title)}</h3>

                        <p class="circle-bfa-excerpt" id="circle-bfa-excerpt">
                            ${escapeHtml(post.excerpt || "Open this file to read the full dispatch.")}
                        </p>

                        <div class="circle-bfa-controls">
                            <button
                                type="button"
                                class="circle-bfa-control"
                                id="circle-bfa-prev"
                                ${hasMultiplePosts ? "" : "disabled"}
                            >
                                Previous
                            </button>

                            <button
                                type="button"
                                class="circle-bfa-read"
                                id="circle-bfa-read"
                            >
                                Read File
                            </button>

                            <button
                                type="button"
                                class="circle-bfa-control"
                                id="circle-bfa-next"
                                ${hasMultiplePosts ? "" : "disabled"}
                            >
                                Next
                            </button>
                        </div>

                        <p class="circle-bfa-position" id="circle-bfa-position">
                            ${BlackwoodMembersState.behindFilesIndex + 1} of ${posts.length}
                        </p>
                    </div>
                </article>

                <div
                    class="circle-bfa-modal"
                    id="circle-bfa-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="circle-bfa-modal-title"
                    hidden
                >
                    <div class="circle-bfa-modal-panel" role="document">
                        <button
                            type="button"
                            class="circle-bfa-modal-close"
                            data-bfa-modal-close
                        >
                            Close File
                        </button>

                        <img
                            class="circle-bfa-modal-image"
                            id="circle-bfa-modal-image"
                            src="${escapeAttribute(post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage)}"
                            alt=""
                        >

                        <div class="circle-bfa-modal-content">
                            <div class="circle-bfa-meta">
                                <span id="circle-bfa-modal-category">${escapeHtml(post.category)}</span>
                                <span id="circle-bfa-modal-date">${escapeHtml(formatBehindFileDate(post.publishedAt))}</span>
                                <span id="circle-bfa-modal-pinned" ${post.pinned ? "" : "hidden"}>Pinned</span>
                            </div>

                            <h3 id="circle-bfa-modal-title">${escapeHtml(post.title)}</h3>

                            <div class="circle-bfa-modal-body" id="circle-bfa-modal-body">
                                ${formatPlainTextAsHtml(post.body || post.excerpt || "No file text has been added yet.")}
                            </div>

                            <div id="circle-bfa-reactions-slot">
                                ${renderBehindFileReactions(post)}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function bindBehindFilesCarousel() {
        const posts = getBehindFilesForDisplay();

        if (!posts.length) {
            return;
        }

        const previousButton = document.getElementById("circle-bfa-prev");
        const nextButton = document.getElementById("circle-bfa-next");
        const readButton = document.getElementById("circle-bfa-read");
        const modal = document.getElementById("circle-bfa-modal");
        const image = document.getElementById("circle-bfa-image");
        const modalImage = document.getElementById("circle-bfa-modal-image");

        if (previousButton) {
            previousButton.addEventListener("click", function () {
                moveBehindFilesCarousel(-1);
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                moveBehindFilesCarousel(1);
            });
        }

        if (readButton) {
            readButton.addEventListener("click", openBehindFileModal);
        }

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeBehindFileModal();
                }
            });
        }

        document.querySelectorAll("[data-bfa-modal-close]").forEach(function (button) {
            button.addEventListener("click", closeBehindFileModal);
        });

        if (image) {
            image.addEventListener("error", function () {
                image.src = BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage;
            });
        }

        if (modalImage) {
            modalImage.addEventListener("error", function () {
                modalImage.src = BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage;
            });
        }

        bindBehindFileReactionButtons();

        if (!BlackwoodMembersState.escapeListenerBound) {
            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape") {
                    closeBehindFileModal();
                }
            });

            BlackwoodMembersState.escapeListenerBound = true;
        }
    }

    function moveBehindFilesCarousel(direction) {
        const posts = getBehindFilesForDisplay();

        if (posts.length <= 1) {
            return;
        }

        const nextIndex = BlackwoodMembersState.behindFilesIndex + direction;

        if (nextIndex < 0) {
            BlackwoodMembersState.behindFilesIndex = posts.length - 1;
        } else if (nextIndex >= posts.length) {
            BlackwoodMembersState.behindFilesIndex = 0;
        } else {
            BlackwoodMembersState.behindFilesIndex = nextIndex;
        }

        updateBehindFilesCarousel();
    }

    function updateBehindFilesCarousel() {
        const posts = getBehindFilesForDisplay();
        const post = posts[clampBehindFilesIndex(BlackwoodMembersState.behindFilesIndex, posts)];

        if (!post) {
            return;
        }

        const image = document.getElementById("circle-bfa-image");
        const category = document.getElementById("circle-bfa-category");
        const date = document.getElementById("circle-bfa-date");
        const pinned = document.getElementById("circle-bfa-pinned");
        const title = document.getElementById("circle-bfa-title");
        const excerpt = document.getElementById("circle-bfa-excerpt");
        const position = document.getElementById("circle-bfa-position");

        if (image) {
            image.src = post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage;
        }

        if (category) {
            category.textContent = post.category;
        }

        if (date) {
            date.textContent = formatBehindFileDate(post.publishedAt);
        }

        if (pinned) {
            pinned.hidden = !post.pinned;
        }

        if (title) {
            title.textContent = post.title;
        }

        if (excerpt) {
            excerpt.textContent = post.excerpt || "Open this file to read the full dispatch.";
        }

        if (position) {
            position.textContent = `${BlackwoodMembersState.behindFilesIndex + 1} of ${posts.length}`;
        }

        updateBehindFileModalContent(post);
    }

    function openBehindFileModal() {
        const modal = document.getElementById("circle-bfa-modal");
        const closeButton = modal ? modal.querySelector("[data-bfa-modal-close]") : null;
        const posts = getBehindFilesForDisplay();
        const post = posts[clampBehindFilesIndex(BlackwoodMembersState.behindFilesIndex, posts)];

        if (!modal || !post) {
            return;
        }

        updateBehindFileModalContent(post);

        modal.hidden = false;
        document.body.classList.add("is-bfa-modal-open");

        if (closeButton) {
            closeButton.focus();
        }
    }

    function closeBehindFileModal() {
        const modal = document.getElementById("circle-bfa-modal");

        if (!modal || modal.hidden) {
            return;
        }

        modal.hidden = true;
        document.body.classList.remove("is-bfa-modal-open");

        const readButton = document.getElementById("circle-bfa-read");

        if (readButton) {
            readButton.focus();
        }
    }

    function updateBehindFileModalContent(post) {
        const modalImage = document.getElementById("circle-bfa-modal-image");
        const modalCategory = document.getElementById("circle-bfa-modal-category");
        const modalDate = document.getElementById("circle-bfa-modal-date");
        const modalPinned = document.getElementById("circle-bfa-modal-pinned");
        const modalTitle = document.getElementById("circle-bfa-modal-title");
        const modalBody = document.getElementById("circle-bfa-modal-body");
        const reactionsSlot = document.getElementById("circle-bfa-reactions-slot");

        if (modalImage) {
            modalImage.src = post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage;
        }

        if (modalCategory) {
            modalCategory.textContent = post.category;
        }

        if (modalDate) {
            modalDate.textContent = formatBehindFileDate(post.publishedAt);
        }

        if (modalPinned) {
            modalPinned.hidden = !post.pinned;
        }

        if (modalTitle) {
            modalTitle.textContent = post.title;
        }

        if (modalBody) {
            modalBody.innerHTML = formatPlainTextAsHtml(
                post.body || post.excerpt || "No file text has been added yet."
            );
        }

        if (reactionsSlot) {
            reactionsSlot.innerHTML = renderBehindFileReactions(post);
            bindBehindFileReactionButtons();
        }
    }

    function renderBehindFileReactions(post) {
        const existingReaction = getReactionForPost(post.id);
        const existingLabel = existingReaction ? existingReaction.reaction : "";
        const hasReacted = Boolean(existingReaction);

        return `
            <section class="circle-bfa-reactions" aria-labelledby="circle-bfa-reactions-title">
                <div class="circle-bfa-reactions-heading">
                    <h4 id="circle-bfa-reactions-title">React to this file</h4>
                    <p>
                        ${
                            hasReacted
                                ? "Your reaction has been filed. You can change it, but points are only awarded once per file."
                                : "File a reaction and receive +5 Circle points. One points award per file."
                        }
                    </p>
                </div>

                <div class="circle-bfa-reaction-buttons">
                    ${BLACKWOOD_BFA_REACTIONS.map(function (reaction) {
                        const isActive = existingLabel === reaction.label;

                        return `
                            <button
                                type="button"
                                class="circle-bfa-reaction-button ${isActive ? "is-active" : ""}"
                                data-bfa-post-id="${escapeAttribute(post.id)}"
                                data-bfa-reaction="${escapeAttribute(reaction.label)}"
                                title="${escapeAttribute(reaction.description)}"
                            >
                                ${escapeHtml(reaction.label)}
                            </button>
                        `;
                    }).join("")}
                </div>

                <p class="circle-bfa-reaction-status" id="circle-bfa-reaction-status" aria-live="polite">
                    ${
                        hasReacted
                            ? `Current reaction: ${escapeHtml(existingLabel)}`
                            : "No reaction filed yet."
                    }
                </p>
            </section>
        `;
    }

    function bindBehindFileReactionButtons() {
        document.querySelectorAll("[data-bfa-reaction]").forEach(function (button) {
            button.addEventListener("click", handleBehindFileReaction);
        });
    }

    async function handleBehindFileReaction(event) {
        const button = event.currentTarget;
        const postId = button.dataset.bfaPostId || "";
        const reaction = button.dataset.bfaReaction || "";

        if (!postId || !reaction) {
            setReactionStatus("This reaction could not be filed.", "is-error");
            return;
        }

        if (BlackwoodMembersState.isReactingToBehindFile) {
            return;
        }

        BlackwoodMembersState.isReactingToBehindFile = true;

        document.querySelectorAll("[data-bfa-reaction]").forEach(function (reactionButton) {
            reactionButton.disabled = true;
        });

        setReactionStatus("Filing your reaction...", "is-loading");

        try {
            const { data, error } = await BlackwoodMembersState.client.rpc("react_to_bfa_post", {
                p_post_id: postId,
                p_reaction: reaction
            });

            if (error) {
                throw error;
            }

            const result = normaliseRpcResult(data);
            const awardedPoints = Number(result.points || 0);

            upsertLocalReaction(postId, reaction, awardedPoints);

            if (result.awarded === true) {
                applyLocalPointAward(awardedPoints || 5, "Reacted to a Behind the Files dispatch");
            }

            updateReactionButtons(postId, reaction);

            setReactionStatus(
                result.message || "Reaction filed.",
                result.awarded === true ? "is-success" : "is-muted"
            );

        } catch (error) {
            console.error("Behind the Files reaction failed:", error);
            setReactionStatus(cleanSupabaseError(error.message), "is-error");

        } finally {
            BlackwoodMembersState.isReactingToBehindFile = false;

            document.querySelectorAll("[data-bfa-reaction]").forEach(function (reactionButton) {
                reactionButton.disabled = false;
            });
        }
    }

    function setReactionStatus(message, className) {
        const status = document.getElementById("circle-bfa-reaction-status");

        if (!status) {
            return;
        }

        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading", "is-muted");

        if (className) {
            status.classList.add(className);
        }
    }

    function getReactionForPost(postId) {
        return BlackwoodMembersState.postReactions.find(function (reaction) {
            return String(reaction.post_id || "") === String(postId || "");
        }) || null;
    }

    function upsertLocalReaction(postId, reaction, pointsAwarded) {
        const existing = getReactionForPost(postId);

        if (existing) {
            existing.reaction = reaction;
            existing.updated_at = new Date().toISOString();
            return;
        }

        BlackwoodMembersState.postReactions.unshift({
            member_id: BlackwoodMembersState.session && BlackwoodMembersState.session.user
                ? BlackwoodMembersState.session.user.id
                : "",
            post_id: postId,
            reaction,
            points_awarded: Number(pointsAwarded || 0),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }

    function updateReactionButtons(postId, reaction) {
        document.querySelectorAll("[data-bfa-reaction]").forEach(function (button) {
            const isSamePost = String(button.dataset.bfaPostId || "") === String(postId || "");
            const isSameReaction = String(button.dataset.bfaReaction || "") === String(reaction || "");

            button.classList.toggle("is-active", isSamePost && isSameReaction);
        });
    }

    function applyLocalPointAward(points, reason) {
        const cleanPoints = Number(points || 0);

        if (!cleanPoints) {
            return;
        }

        if (BlackwoodMembersState.member) {
            BlackwoodMembersState.member.points_total = Number(BlackwoodMembersState.member.points_total || 0) + cleanPoints;
        }

        BlackwoodMembersState.points.unshift({
            points: cleanPoints,
            reason: reason || "Blackwood Circle activity",
            created_at: new Date().toISOString()
        });

        const pointsTotal = document.getElementById("circle-points-total");
        const homePointsTotal = document.getElementById("circle-home-points-total");

        if (pointsTotal) {
            pointsTotal.textContent = String(Number(pointsTotal.textContent || 0) + cleanPoints);
        }

        if (homePointsTotal) {
            homePointsTotal.textContent = String(Number(homePointsTotal.textContent || 0) + cleanPoints);
        }

        const pointsList = document.querySelector(".circle-points-list");

        if (pointsList) {
            pointsList.innerHTML = renderPointsHistory();
        }
    }

    function normaliseRpcResult(data) {
        if (!data) {
            return {};
        }

        if (typeof data === "string") {
            try {
                return JSON.parse(data);
            } catch (error) {
                return {};
            }
        }

        return data;
    }

    function clampBehindFilesIndex(index, posts) {
        if (!Array.isArray(posts) || !posts.length) {
            return 0;
        }

        if (index < 0) {
            return 0;
        }

        if (index >= posts.length) {
            return posts.length - 1;
        }

        return index;
    }

    function formatBehindFileDate(value) {
        if (!value) {
            return "Filed in the archive";
        }

        const date = new Date(`${value}T12:00:00`);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    // =========================
    // REWARDS / REDEMPTIONS / POINTS
    // =========================

    function renderRewards(pointsTotal) {
    if (!BlackwoodMembersState.rewards.length) {
        return `
            <article class="circle-empty-card">
                <p>No rewards have been filed yet.</p>
            </article>
        `;
    }

    return BlackwoodMembersState.rewards.map(function (reward) {
        const rewardId = Number(reward.id);
        const required = Number(reward.points_required || 0);
        const unlocked = pointsTotal >= required;
        const isRedeemable = reward.is_redeemable === true;
        const latestRedemption = getLatestRedemptionForReward(rewardId, reward.title);
        const activeRedemption = isActiveRedemption(latestRedemption);
        const canRedeem = isRedeemable && unlocked && !activeRedemption;

        const rewardStatus = getRewardStatusInfo({
            reward,
            pointsTotal,
            latestRedemption,
            unlocked,
            isRedeemable
        });

        return `
            <article class="circle-reward-card ${unlocked ? "is-unlocked" : "is-locked"} ${isRedeemable ? "is-redeemable" : "is-milestone"}">
                <div class="circle-reward-card-header">
                    <p class="circle-reward-status">
                        ${escapeHtml(isRedeemable ? "Redeemable Reward" : "Circle Milestone")}
                    </p>

                    <span class="circle-reward-badge ${escapeAttribute(rewardStatus.className)}">
                        ${escapeHtml(rewardStatus.label)}
                    </span>
                </div>

                <h3>${escapeHtml(reward.title)}</h3>

                <p>${escapeHtml(reward.description || "")}</p>

                <small>
                    Requires ${required} points · ${escapeHtml(reward.required_tier || "Reader")}
                </small>

                ${renderRewardProgress(pointsTotal, required, unlocked, isRedeemable)}

                ${renderRewardAction(reward, canRedeem, latestRedemption)}
            </article>
        `;
    }).join("");
}

function getRewardStatusInfo(options) {
    const reward = options.reward || {};
    const pointsTotal = Number(options.pointsTotal || 0);
    const latestRedemption = options.latestRedemption || null;
    const unlocked = options.unlocked === true;
    const isRedeemable = options.isRedeemable === true;
    const required = Number(reward.points_required || 0);

    const latestStatus = latestRedemption
        ? String(latestRedemption.status || "").toLowerCase()
        : "";

    if (latestStatus === "pending") {
        return {
            label: "Request Pending",
            className: "is-pending"
        };
    }

    if (latestStatus === "issued") {
        return {
            label: "Code Issued",
            className: "is-issued"
        };
    }

    if (latestStatus === "used") {
        return {
            label: "Used",
            className: "is-used"
        };
    }

    if (latestStatus === "cancelled") {
        return {
            label: "Cancelled",
            className: "is-cancelled"
        };
    }

    if (!unlocked) {
        return {
            label: `${Math.max(0, required - pointsTotal)} Points To Unlock`,
            className: "is-locked"
        };
    }

    if (isRedeemable) {
        return {
            label: "Unlocked",
            className: "is-unlocked"
        };
    }

    return {
        label: "Milestone Reached",
        className: "is-milestone"
    };
}

function renderRewardProgress(pointsTotal, required, unlocked, isRedeemable) {
    const cleanRequired = Math.max(0, Number(required || 0));
    const cleanPoints = Math.max(0, Number(pointsTotal || 0));

    if (!cleanRequired) {
        return "";
    }

    const progress = Math.min(100, Math.round((cleanPoints / cleanRequired) * 100));
    const remaining = Math.max(0, cleanRequired - cleanPoints);

    let note = `${remaining} more points needed.`;

    if (unlocked && isRedeemable) {
        note = "Unlocked and available to redeem.";
    }

    if (unlocked && !isRedeemable) {
        note = "Milestone reached on your Circle record.";
    }

    return `
        <div class="circle-reward-progress" aria-label="Reward progress">
            <span style="width: ${escapeAttribute(String(progress))}%"></span>
        </div>

        <p class="circle-reward-progress-note">
            ${escapeHtml(note)}
        </p>
    `;
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
                <p>Your discount code or reward confirmation will be issued manually and shown here once ready.</p>
            </div>
        `;
    }

    let existingRedemptionNotice = "";

    if (latestStatus === "issued") {
        existingRedemptionNotice = `
            <div class="circle-redemption-notice is-issued">
                <strong>Reward issued</strong>

                ${latestRedemption.discount_code ? `
                    <div class="circle-redemption-code">
                        <span>Your Circle code</span>

                        <div class="circle-redemption-code-row">
                            <code>${escapeHtml(latestRedemption.discount_code)}</code>

                            <button
                                type="button"
                                class="circle-copy-code-button"
                                data-copy-discount-code="${escapeAttribute(latestRedemption.discount_code)}"
                            >
                                Copy Code
                            </button>
                        </div>
                    </div>
                ` : `
                    <p>Your reward has been issued and will appear here shortly.</p>
                `}
            </div>
        `;
    }

    if (latestStatus === "used") {
        existingRedemptionNotice = `
            <div class="circle-redemption-notice is-used">
                <strong>Reward used</strong>
                <p>This redemption has already been used.</p>
            </div>
        `;
    }

    if (latestStatus === "cancelled") {
        existingRedemptionNotice = `
            <div class="circle-redemption-notice is-cancelled">
                <strong>Redemption cancelled</strong>
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
            <article class="circle-empty-card circle-redemptions-empty">
                <p>No rewards claimed yet.</p>
                <p>When you unlock a Circle reward, your request and discount code will appear here.</p>
            </article>
        `;
    }

    return BlackwoodMembersState.redemptions.map(function (redemption) {
        const cleanStatus = String(redemption.status || "pending").toLowerCase();
        const status = capitalise(cleanStatus);
        const requestedDate = redemption.requested_at
            ? formatDate(redemption.requested_at)
            : formatDate(redemption.created_at);

        const pointsCost = Number(redemption.points_cost || 0);
        const pointsLine = pointsCost > 0
            ? `${pointsCost} points redeemed.`
            : "Complimentary reward issued.";

        return `
            <article class="circle-reward-card circle-redemption-card">
                <div class="circle-redemption-card-header">
                    <p class="circle-post-meta">
                        ${escapeHtml(requestedDate)}
                    </p>

                    <span class="circle-reward-badge is-${escapeAttribute(cleanStatus)}">
                        ${escapeHtml(status)}
                    </span>
                </div>

                <h3>${escapeHtml(redemption.reward_title || "Blackwood Circle reward")}</h3>

                <p>
                    ${escapeHtml(pointsLine)}
                </p>

                ${redemption.discount_code ? `
                    <div class="circle-redemption-code">
                        <span>Discount code</span>

                        <div class="circle-redemption-code-row">
                            <code>${escapeHtml(redemption.discount_code)}</code>

                            <button
                                type="button"
                                class="circle-copy-code-button"
                                data-copy-discount-code="${escapeAttribute(redemption.discount_code)}"
                            >
                                Copy Code
                            </button>
                        </div>
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

        return BlackwoodMembersState.points.map(function (point) {
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

        if (signOutButton) {
            signOutButton.addEventListener("click", handleMemberSignOut);
        }

        if (refreshButton) {
            refreshButton.addEventListener("click", loadMemberDashboard);
        }

        document.querySelectorAll("[data-redeem-reward-id]").forEach(function (button) {
            button.addEventListener("click", handleRewardRedemption);
        });

        document.querySelectorAll("[data-copy-discount-code]").forEach(function (button) {
        button.addEventListener("click", handleCopyDiscountCode);
        });
        
        bindMemberArcProfile();
        bindBlackwoodBookshelf();
        bindBehindFilesCarousel();
        bindPointsHistoryToggle();
    }

    function bindPointsHistoryToggle() {
        const button = document.getElementById("circle-points-history-toggle");
        const section = button ? button.closest(".circle-collapsible-section") : null;

        if (!section || !button) {
            return;
        }

        button.addEventListener("click", function () {
            const isCollapsed = section.classList.toggle("is-collapsed");
            const isOpen = !isCollapsed;

            button.textContent = isOpen ? "Hide history" : "Show history";
            button.setAttribute("aria-expanded", String(isOpen));
        });
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

    function getLatestRedemptionForReward(rewardId, rewardTitle) {
    const byRewardId = BlackwoodMembersState.redemptions.find(function (redemption) {
        return Number(redemption.reward_id) === Number(rewardId);
    });

    if (byRewardId) {
        return byRewardId;
    }

    return BlackwoodMembersState.redemptions.find(function (redemption) {
        return lowerClean(redemption.reward_title) === lowerClean(rewardTitle);
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
                <p>Your member record is being retrieved.</p>
            </section>
        `;
    }

    function renderErrorState(message) {
        BlackwoodMembersState.app.innerHTML = `
            <section class="circle-error">
                <p class="circle-kicker">The Blackwood Circle</p>
                <h1>Something went wrong</h1>
                <p>${escapeHtml(message)}</p>
                <button type="button" class="circle-button circle-button-primary" id="circle-reload-page">
                    Refresh Page
                </button>
            </section>
        `;

        const reloadButton = document.getElementById("circle-reload-page");

        if (reloadButton) {
            reloadButton.addEventListener("click", function () {
                window.location.reload();
            });
        }
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
        const metadata = user.user_metadata || {};

        return {
            id: user.id,
            email: user.email || "",
            display_name: metadata.display_name || "",
            reader_name: metadata.reader_name || "",
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
            .map(function (paragraph) {
                return `<p>${paragraph.replace(/\n/g, "<br>")}</p>`;
            })
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

        if (/reaction is not available/i.test(cleaned) || /not available/i.test(cleaned)) {
            return "That reaction is not available.";
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
    async function handleCopyDiscountCode(event) {
    const button = event.currentTarget;
    const code = button.getAttribute("data-copy-discount-code") || "";

    if (!code) {
        setDashboardStatus("No discount code was found to copy.", "is-error");
        return;
    }

    const originalText = button.textContent;

    try {
        await copyTextToClipboard(code);

        button.textContent = "Copied";
        button.classList.add("is-copied");

        setDashboardStatus("Discount code copied to clipboard.", "is-success");

        window.setTimeout(function () {
            button.textContent = originalText || "Copy Code";
            button.classList.remove("is-copied");
        }, 1600);

    } catch (error) {
        console.warn("Copy discount code failed:", error);
        setDashboardStatus("The code could not be copied. Please copy it manually.", "is-error");
    }
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand("copy");

    textarea.remove();

    if (!copied) {
        throw new Error("Copy command failed.");
    }
}

function lowerClean(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}
    
    function looksLikeUrl(value) {
        return /^https?:\/\//i.test(String(value || "").trim());
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
})();
