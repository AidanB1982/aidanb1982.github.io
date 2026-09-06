// =========================
// BLACKWOOD CIRCLE MEMBERS
// Supabase Auth + Member Dashboard + Rewards Redemption + Password Reset
// Behind the Files carousel powered by /data/BFA.json
// Behind the Files reactions powered by Supabase
// ARC Profile powered by /js/member-arc-profile.js
// Blackwood Bookshelf powered by /js/member-bookshelf.js
// Phase 2A: Member Home Dashboard summary layer
// Phase 2B: Rewards polish + delivery address collection
// Phase 2D: Admin Reward Fulfilment Desk
// =========================

(function () {
    "use strict";

    if (window.__BLACKWOOD_MEMBERS_SCRIPT_LOADED__) {
        return;
    }

    window.__BLACKWOOD_MEMBERS_SCRIPT_LOADED__ = true;

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

    const BLACKWOOD_ADMIN_REWARD_FILTERS = [
        {
            id: "all",
            label: "All"
        },
        {
            id: "pending",
            label: "Pending"
        },
        {
            id: "address_needed",
            label: "Address Needed"
        },
        {
            id: "address_received",
            label: "Address Received"
        },
        {
            id: "issued",
            label: "Issued"
        },
        {
            id: "used",
            label: "Used"
        },
        {
            id: "cancelled",
            label: "Cancelled"
        }
    ];

    const BLACKWOOD_ADMIN_DELIVERY_STATUS_OPTIONS = [
        {
            value: "",
            label: "Not set"
        },
        {
            value: "not_required",
            label: "Not required"
        },
        {
            value: "address_required",
            label: "Address required"
        },
        {
            value: "address_received",
            label: "Address received"
        },
        {
            value: "posted",
            label: "Posted"
        },
        {
            value: "fulfilled",
            label: "Fulfilled"
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
    adminRewardRedemptions: [],
    adminRewardFilter: "all",
    adminRewardDeskOpen: false,
    adminRewardLoadError: "",

    premiumDisclosures: {
        behindFiles: true,
        rewards: false,
        redemptions: false,
        points: false
    },

    activeAuthMode: "signin",
    isRedeeming: false,
    isSubmittingDeliveryAddress: false,
    isReactingToBehindFile: false,
    isAdminRewardBusy: false,
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

    if (event === "INITIAL_SESSION") {
        return;
    }

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

        BlackwoodMembersState.app.innerHTML = `
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
            BlackwoodMembersState.adminRewardRedemptions = [];
            BlackwoodMembersState.adminRewardFilter = "all";
            BlackwoodMembersState.adminRewardDeskOpen = false;
            BlackwoodMembersState.adminRewardLoadError = "";
            BlackwoodMembersState.isRedeeming = false;
            BlackwoodMembersState.isSubmittingDeliveryAddress = false;
            BlackwoodMembersState.isReactingToBehindFile = false;
            BlackwoodMembersState.isAdminRewardBusy = false;

            updateMemberIntroVisibility(null);
            renderAuthView();

        } catch (error) {
            console.error("Blackwood Circle sign out failed:", error);
            setDashboardStatus("Sign out failed. Please try again.", "is-error");
        }
    }

    // =========================
    // DASHBOARD LOADING
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

            const memberProfile = profileResult.data || buildFallbackProfile(user);
            const adminRewardRedemptions = await loadAdminRewardDashboardIfAllowed(memberProfile);

            BlackwoodMembersState.member = memberProfile;
            BlackwoodMembersState.posts = legacyPosts || [];
            BlackwoodMembersState.behindFiles = behindFiles || [];
            BlackwoodMembersState.behindFilesIndex = 0;
            BlackwoodMembersState.postReactions = postReactions || [];
            BlackwoodMembersState.rewards = rewardsResult.data || [];
            BlackwoodMembersState.points = pointsResult.data || [];
            BlackwoodMembersState.redemptions = redemptionsResult.data || [];
            BlackwoodMembersState.arcAssignments = arcAssignments || [];
            BlackwoodMembersState.adminRewardRedemptions = adminRewardRedemptions || [];

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

    // =========================
    // DASHBOARD RENDER
    // =========================

    function renderDashboard() {
        const app = BlackwoodMembersState.app;
        const member = BlackwoodMembersState.member || {};
        const pointsTotal = getCurrentPointsTotal();

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

                    <a href="${BLACKWOOD_MEMBERS_CONFIG.readerRecordsPagePath}" class="circle-reader-record-button">
                        Leave a Reader Record
                    </a>
                </section>

                ${renderArcProfileMount()}

                ${renderBookshelfMount()}

                ${renderAdminRewardDesk()}

                ${renderBehindFilesCarousel()}

                ${renderRewardsDisclosure(pointsTotal)}

                ${renderRedemptionsDisclosure()}
                
                ${renderPointsDisclosure(pointsTotal)}
        </section>
        `;

       bindDashboardEvents();
    }

    function renderMemberHomeDashboard(member, pointsTotal, summary) {
        const arcSummary = getArcDashboardSummary(member);
        const rewardSummary = getRewardsDashboardSummary(pointsTotal);
        const redemptionSummary = getRedemptionDashboardSummary();
        const adminRewardSummary = getAdminRewardDashboardSummary();
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

                        <a
                            href="#circle-panel-rewards"
                            class="circle-button circle-button-secondary"
                            data-circle-open-panel="rewards"
                        >
                            View Rewards
                        </a>
                        
                        <a
                            href="#circle-panel-behindFiles"
                            class="circle-button circle-button-secondary"
                            data-circle-open-panel="behindFiles"
                        >
                            Latest Dispatch
                        </a>

                        <a href="#blackwood-bookshelf-root" class="circle-button circle-button-secondary">
                            My Bookshelf
                        </a>

                        ${
                            isAdminProfile(member)
                                ? `
                                    <a href="#circle-admin-reward-desk" class="circle-button circle-button-secondary">
                                        Admin Reward Desk
                                    </a>
                                `
                                : ""
                        }
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

                    ${
                        isAdminProfile(member)
                            ? `
                                <article class="circle-home-summary-card">
                                    <span>Admin Rewards</span>
                                    <h3>${escapeHtml(adminRewardSummary.headline)}</h3>
                                    <p>${escapeHtml(adminRewardSummary.detail)}</p>
                                </article>
                            `
                            : ""
                    }
                </div>
            </section>
        `;
    }

    function getCurrentPointsTotal() {
        const member = BlackwoodMembersState.member || {};
        const profilePoints = Number(member.points_total);

        if (Number.isFinite(profilePoints)) {
            return profilePoints;
        }

        return BlackwoodMembersState.points.reduce(function (total, item) {
            return total + Number(item.points || 0);
        }, 0);
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

        const awaitingAddress = redemptions.filter(function (redemption) {
            return isPhysicalDeliveryReward(redemption) &&
                String(redemption.delivery_status || "").toLowerCase() === "address_required" &&
                !hasDeliveryAddress(redemption);
        });

        const latestWithCode = redemptions.find(function (redemption) {
            return Boolean(redemption.discount_code);
        });

        if (awaitingAddress.length) {
            return {
                headline: `${awaitingAddress.length} address needed`,
                detail: "A physical reward is waiting for delivery details."
            };
        }

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

    function getAdminRewardDashboardSummary() {
        const redemptions = Array.isArray(BlackwoodMembersState.adminRewardRedemptions)
            ? BlackwoodMembersState.adminRewardRedemptions
            : [];

        if (BlackwoodMembersState.adminRewardLoadError) {
            return {
                headline: "Needs check",
                detail: "The admin reward desk could not be loaded."
            };
        }

        if (!redemptions.length) {
            return {
                headline: "Clear",
                detail: "No reward requests currently need admin attention."
            };
        }

        const counts = getAdminRewardFilterCounts(redemptions);

        if (counts.address_received) {
            return {
                headline: `${counts.address_received} ready`,
                detail: "Physical reward address received and waiting fulfilment."
            };
        }

        if (counts.address_needed) {
            return {
                headline: `${counts.address_needed} address needed`,
                detail: "Physical rewards are waiting for delivery details."
            };
        }

        if (counts.pending) {
            return {
                headline: `${counts.pending} pending`,
                detail: "Reward requests are waiting for review."
            };
        }

        return {
            headline: `${redemptions.length} filed`,
            detail: "Reward requests are available in the admin desk."
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

    function isAdminProfile(member) {
        if (!member) {
            return false;
        }

        return member.is_admin === true ||
            String(member.is_admin || "").toLowerCase() === "true";
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

    if (!root) {
        return;
    }

    if (typeof window.initBlackwoodBookshelf !== "function") {
        root.innerHTML = `
            <div class="blackwood-bookshelf">
                <div class="bookshelf-empty-card">
                    <p class="bookshelf-kicker">My Blackwood Bookshelf</p>
                    <h3>Bookshelf unavailable</h3>
                    <p>The bookshelf script could not be loaded. Please refresh the page.</p>
                </div>
            </div>
        `;
        return;
    }

    try {
        window.initBlackwoodBookshelf({
            root,
            client: BlackwoodMembersState.client,
            session: BlackwoodMembersState.session,
            member: BlackwoodMembersState.member,
            pointsTotal: getCurrentPointsTotal()
        });
    } catch (error) {
        console.error("Blackwood Bookshelf bind failed:", error);

        root.innerHTML = `
            <div class="blackwood-bookshelf">
                <div class="bookshelf-empty-card">
                    <p class="bookshelf-kicker">My Blackwood Bookshelf</p>
                    <h3>Bookshelf error</h3>
                    <p>Your bookshelf could not be opened. Please refresh and try again.</p>
                </div>
            </div>
        `;
    }
}

    // =========================
    // ADMIN REWARD FULFILMENT DESK
    // =========================

    async function loadAdminRewardDashboardIfAllowed(member) {
        BlackwoodMembersState.adminRewardLoadError = "";

        if (!isAdminProfile(member)) {
            return [];
        }

        try {
            const { data, error } = await BlackwoodMembersState.client.rpc(
                "get_member_reward_admin_dashboard"
            );

            if (error) {
                throw error;
            }

            return Array.isArray(data)
                ? data.map(normaliseAdminRewardRedemption)
                : [];

        } catch (error) {
            console.warn("Admin reward dashboard could not be loaded:", error.message || error);
            BlackwoodMembersState.adminRewardLoadError = cleanSupabaseError(error.message);
            return [];
        }
    }

    function renderAdminRewardDesk() {
        const member = BlackwoodMembersState.member;

        if (!isAdminProfile(member)) {
            return "";
        }

        const redemptions = Array.isArray(BlackwoodMembersState.adminRewardRedemptions)
            ? BlackwoodMembersState.adminRewardRedemptions
            : [];

        const filteredRedemptions = getFilteredAdminRewardRedemptions();
        const counts = getAdminRewardFilterCounts(redemptions);
        const summary = getAdminRewardDashboardSummary();
        const openAttribute = BlackwoodMembersState.adminRewardDeskOpen ? "open" : "";

        return `
            <section
                class="circle-section circle-admin-reward-section"
                id="circle-admin-reward-desk"
                aria-labelledby="circle-admin-reward-title"
            >
                <details class="circle-admin-reward-desk" data-admin-reward-desk ${openAttribute}>
                    <summary class="circle-admin-reward-summary">
                        <div>
                            <p class="circle-kicker">Admin Only</p>
                            <h2 id="circle-admin-reward-title">Reward Fulfilment Desk</h2>
                            <p>
                                Review reward requests, delivery addresses, discount codes, fulfilment notes,
                                and status updates from one private admin panel.
                            </p>
                        </div>

                        <div class="circle-admin-reward-summary-side">
                            <span>${escapeHtml(summary.headline)}</span>
                            <small>${escapeHtml(summary.detail)}</small>
                        </div>
                    </summary>

                    <div class="circle-admin-reward-panel">
                        ${
                            BlackwoodMembersState.adminRewardLoadError
                                ? `
                                    <article class="circle-empty-card circle-admin-reward-error">
                                        <p>${escapeHtml(BlackwoodMembersState.adminRewardLoadError)}</p>
                                    </article>
                                `
                                : `
                                    ${renderAdminRewardFilters(counts)}

                                    <p
                                        class="circle-admin-reward-status"
                                        id="circle-admin-reward-status"
                                        aria-live="polite"
                                    ></p>

                                    ${
                                        filteredRedemptions.length
                                            ? `
                                                <div class="circle-admin-reward-list">
                                                    ${filteredRedemptions.map(renderAdminRewardCard).join("")}
                                                </div>
                                            `
                                            : `
                                                <article class="circle-empty-card">
                                                    <p>No reward requests match this filter.</p>
                                                </article>
                                            `
                                    }
                                `
                        }
                    </div>
                </details>
            </section>
        `;
    }

    function renderAdminRewardFilters(counts) {
        return `
            <div class="circle-admin-reward-filters" aria-label="Admin reward filters">
                ${BLACKWOOD_ADMIN_REWARD_FILTERS.map(function (filter) {
                    const isActive = BlackwoodMembersState.adminRewardFilter === filter.id;
                    const count = counts[filter.id] || 0;

                    return `
                        <button
                            type="button"
                            class="${isActive ? "is-active" : ""}"
                            data-admin-reward-filter="${escapeAttribute(filter.id)}"
                            aria-pressed="${isActive ? "true" : "false"}"
                        >
                            <span>${escapeHtml(filter.label)}</span>
                            <strong>${escapeHtml(String(count))}</strong>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderAdminRewardCard(redemption) {
        const redemptionId = Number(redemption.redemption_id || 0);
        const status = normaliseRedemptionStatus(redemption.status);
        const deliveryStatus = normaliseAdminDeliveryStatus(redemption.delivery_status);
        const hasAddress = hasAdminDeliveryAddress(redemption);
        const physicalReward = isAdminPhysicalDeliveryReward(redemption);
        const needsAddressBeforeIssue = physicalReward &&
            deliveryStatus === "address_required" &&
            !hasAddress;

        const requestedDate = redemption.requested_at
            ? formatDate(redemption.requested_at)
            : formatDate(redemption.created_at);

        const issuedDate = redemption.issued_at ? formatDate(redemption.issued_at) : "";
        const usedDate = redemption.used_at ? formatDate(redemption.used_at) : "";
        const cancelledDate = redemption.cancelled_at ? formatDate(redemption.cancelled_at) : "";

        return `
            <article
                class="circle-admin-reward-card is-${escapeAttribute(status)}"
                data-admin-redemption-card="${redemptionId}"
            >
                <div class="circle-admin-reward-card-header">
                    <div>
                        <p class="circle-post-meta">
                            Request #${escapeHtml(String(redemptionId))} · ${escapeHtml(requestedDate || "Date unknown")}
                        </p>

                        <h3>${escapeHtml(redemption.reward_title || "Blackwood Circle reward")}</h3>

                        <p>
                            ${escapeHtml(redemption.reader_name || "Unknown reader")}
                            ${redemption.reader_email ? ` · ${escapeHtml(redemption.reader_email)}` : ""}
                        </p>
                    </div>

                    <div class="circle-admin-reward-badges">
                        <span class="circle-reward-badge is-${escapeAttribute(status)}">
                            ${escapeHtml(capitalise(status))}
                        </span>

                        ${
                            deliveryStatus
                                ? `
                                    <span class="circle-reward-badge is-delivery">
                                        ${escapeHtml(getAdminDeliveryStatusLabel(deliveryStatus))}
                                    </span>
                                `
                                : ""
                        }
                    </div>
                </div>

                <div class="circle-admin-reward-meta-grid">
                    <div>
                        <span>Points</span>
                        <strong>${escapeHtml(String(Number(redemption.points_cost || 0)))}</strong>
                    </div>

                    <div>
                        <span>Fulfilment</span>
                        <strong>${escapeHtml(redemption.fulfilment_state || "Filed")}</strong>
                    </div>

                    <div>
                        <span>Issued</span>
                        <strong>${escapeHtml(issuedDate || "—")}</strong>
                    </div>

                    <div>
                        <span>Used / Cancelled</span>
                        <strong>${escapeHtml(usedDate || cancelledDate || "—")}</strong>
                    </div>
                </div>

                ${renderAdminRewardAddressBlock(redemption)}

                <form
                    class="circle-admin-reward-form"
                    data-admin-redemption-form="${redemptionId}"
                    novalidate
                >
                    <div class="circle-admin-reward-form-grid">
                        <label>
                            Discount code
                            <input
                                type="text"
                                name="discount_code"
                                value="${escapeAttribute(redemption.discount_code || "")}"
                                placeholder="Optional code"
                            >
                        </label>

                        <label>
                            Delivery status
                            <select name="delivery_status">
                                ${renderAdminDeliveryStatusOptions(deliveryStatus)}
                            </select>
                        </label>

                        <label class="circle-admin-reward-note-field">
                            Admin note
                            <textarea
                                name="admin_note"
                                rows="3"
                                maxlength="1000"
                                placeholder="Private fulfilment note"
                            >${escapeHtml(redemption.admin_note || "")}</textarea>
                        </label>
                    </div>

                    <div class="circle-admin-reward-actions">
                        <button
                            type="submit"
                            class="circle-button circle-button-secondary"
                            data-admin-redemption-save
                        >
                            Save Details
                        </button>

                        <button
                            type="button"
                            class="circle-button circle-button-primary"
                            data-admin-redemption-action="issued"
                            data-admin-redemption-id="${redemptionId}"
                            ${status === "issued" || status === "used" || status === "cancelled" || needsAddressBeforeIssue ? "disabled" : ""}
                            title="${needsAddressBeforeIssue ? "Delivery address required before issuing this reward." : ""}"
                        >
                            Mark Issued
                        </button>

                        <button
                            type="button"
                            class="circle-button circle-button-secondary"
                            data-admin-redemption-action="used"
                            data-admin-redemption-id="${redemptionId}"
                            ${status === "used" || status === "cancelled" ? "disabled" : ""}
                        >
                            Mark Used
                        </button>

                        <button
                            type="button"
                            class="circle-button circle-button-secondary is-danger"
                            data-admin-redemption-action="cancelled"
                            data-admin-redemption-id="${redemptionId}"
                            ${status === "used" || status === "cancelled" ? "disabled" : ""}
                        >
                            Cancel
                        </button>

                        ${
                            hasAddress
                                ? `
                                    <button
                                        type="button"
                                        class="circle-button circle-button-secondary"
                                        data-admin-copy-address="${redemptionId}"
                                    >
                                        Copy Address
                                    </button>
                                `
                                : ""
                        }

                        ${
                            redemption.discount_code
                                ? `
                                    <button
                                        type="button"
                                        class="circle-button circle-button-secondary"
                                        data-copy-discount-code="${escapeAttribute(redemption.discount_code)}"
                                    >
                                        Copy Code
                                    </button>
                                `
                                : ""
                        }
                    </div>

                    ${
                        needsAddressBeforeIssue
                            ? `
                                <p class="circle-admin-reward-warning">
                                    This looks like a physical reward and still needs a delivery address before issuing.
                                </p>
                            `
                            : ""
                    }
                </form>
            </article>
        `;
    }

    function renderAdminRewardAddressBlock(redemption) {
        if (hasAdminDeliveryAddress(redemption)) {
            return `
                <div class="circle-admin-delivery-card">
                    <div>
                        <strong>Delivery address</strong>

                        <address>
                            ${formatAdminDeliveryAddressHtml(redemption)}
                        </address>
                    </div>

                    ${
                        redemption.delivery_note
                            ? `
                                <p>
                                    <span>Delivery note</span>
                                    ${escapeHtml(redemption.delivery_note)}
                                </p>
                            `
                            : ""
                    }
                </div>
            `;
        }

        if (String(redemption.delivery_status || "").toLowerCase() === "address_required") {
            return `
                <div class="circle-admin-delivery-card is-needed">
                    <strong>Delivery address needed</strong>
                    <p>The member has not submitted delivery details for this physical reward yet.</p>
                </div>
            `;
        }

        return "";
    }

    function renderAdminDeliveryStatusOptions(currentValue) {
        const cleanCurrentValue = normaliseAdminDeliveryStatus(currentValue);

        return BLACKWOOD_ADMIN_DELIVERY_STATUS_OPTIONS.map(function (option) {
            return `
                <option
                    value="${escapeAttribute(option.value)}"
                    ${option.value === cleanCurrentValue ? "selected" : ""}
                >
                    ${escapeHtml(option.label)}
                </option>
            `;
        }).join("");
    }

    function bindAdminRewardDeskEvents() {
        const desk = document.querySelector("[data-admin-reward-desk]");

        if (desk) {
            desk.addEventListener("toggle", function () {
                BlackwoodMembersState.adminRewardDeskOpen = desk.open;
            });
        }

        document.querySelectorAll("[data-admin-reward-filter]").forEach(function (button) {
            button.addEventListener("click", function () {
                BlackwoodMembersState.adminRewardFilter = normaliseAdminRewardFilter(
                    button.dataset.adminRewardFilter || "all"
                );

                BlackwoodMembersState.adminRewardDeskOpen = true;
                renderAdminRewardDeskInPlace();
            });
        });

        document.querySelectorAll("[data-admin-redemption-form]").forEach(function (form) {
            form.addEventListener("submit", handleAdminRewardSave);
        });

        document.querySelectorAll("[data-admin-redemption-action]").forEach(function (button) {
            button.addEventListener("click", handleAdminRewardStatusAction);
        });

        document.querySelectorAll("[data-admin-copy-address]").forEach(function (button) {
            button.addEventListener("click", handleAdminCopyAddress);
        });
    }

    async function handleAdminRewardSave(event) {
        event.preventDefault();

        if (BlackwoodMembersState.isAdminRewardBusy) {
            return;
        }

        const form = event.currentTarget;
        const redemptionId = Number(form.dataset.adminRedemptionForm || 0);

        if (!redemptionId) {
            setAdminRewardStatus("This reward request could not be found.", "is-error");
            return;
        }

        const payload = getAdminRewardFormPayload(form, true);

        BlackwoodMembersState.isAdminRewardBusy = true;
        setAdminRewardStatus("Saving reward details...", "is-loading");
        setAdminRewardControlsDisabled(true);

        try {
            const { error } = await BlackwoodMembersState.client.rpc(
                "admin_update_member_reward_redemption",
                {
                    p_redemption_id: redemptionId,
                    p_status: null,
                    p_discount_code: payload.discountCode,
                    p_admin_note: payload.adminNote,
                    p_delivery_status: payload.deliveryStatus || null
                }
            );

            if (error) {
                throw error;
            }

            await refreshAdminRewardDesk("Reward details saved.", "is-success");

        } catch (error) {
            console.error("Admin reward save failed:", error);
            setAdminRewardStatus(cleanSupabaseError(error.message), "is-error");
            setAdminRewardControlsDisabled(false);

        } finally {
            BlackwoodMembersState.isAdminRewardBusy = false;
        }
    }

    async function handleAdminRewardStatusAction(event) {
        if (BlackwoodMembersState.isAdminRewardBusy) {
            return;
        }

        const button = event.currentTarget;
        const redemptionId = Number(button.dataset.adminRedemptionId || 0);
        const action = normaliseRedemptionStatus(button.dataset.adminRedemptionAction || "");
        const redemption = getAdminRewardRedemptionById(redemptionId);

        if (!redemptionId || !redemption) {
            setAdminRewardStatus("This reward request could not be found.", "is-error");
            return;
        }

        if (!["issued", "used", "cancelled"].includes(action)) {
            setAdminRewardStatus("That reward action is not available.", "is-error");
            return;
        }

        if (action === "cancelled") {
            const confirmed = window.confirm(
                `Cancel "${redemption.reward_title || "this reward"}" for ${redemption.reader_name || "this reader"}?`
            );

            if (!confirmed) {
                return;
            }
        }

        const form = document.querySelector(`[data-admin-redemption-form="${redemptionId}"]`);
        const formPayload = form ? getAdminRewardFormPayload(form, false) : {
            discountCode: null,
            adminNote: null,
            deliveryStatus: null
        };

        BlackwoodMembersState.isAdminRewardBusy = true;
        setAdminRewardStatus(`Updating reward to ${action}...`, "is-loading");
        setAdminRewardControlsDisabled(true);

        try {
            const { error } = await BlackwoodMembersState.client.rpc(
                "admin_update_member_reward_redemption",
                {
                    p_redemption_id: redemptionId,
                    p_status: action,
                    p_discount_code: formPayload.discountCode,
                    p_admin_note: formPayload.adminNote,
                    p_delivery_status: formPayload.deliveryStatus
                }
            );

            if (error) {
                throw error;
            }

            await refreshAdminRewardDesk(`Reward marked ${action}.`, "is-success");

        } catch (error) {
            console.error("Admin reward status update failed:", error);
            setAdminRewardStatus(cleanSupabaseError(error.message), "is-error");
            setAdminRewardControlsDisabled(false);

        } finally {
            BlackwoodMembersState.isAdminRewardBusy = false;
        }
    }

    async function handleAdminCopyAddress(event) {
        const button = event.currentTarget;
        const redemptionId = Number(button.dataset.adminCopyAddress || 0);
        const redemption = getAdminRewardRedemptionById(redemptionId);

        if (!redemption || !hasAdminDeliveryAddress(redemption)) {
            setAdminRewardStatus("No delivery address was found to copy.", "is-error");
            return;
        }

        const originalText = button.textContent;

        try {
            await copyTextToClipboard(formatAdminDeliveryAddressPlain(redemption));

            button.textContent = "Copied";
            button.classList.add("is-copied");

            setAdminRewardStatus("Delivery address copied to clipboard.", "is-success");

            window.setTimeout(function () {
                button.textContent = originalText || "Copy Address";
                button.classList.remove("is-copied");
            }, 1600);

        } catch (error) {
            console.warn("Copy address failed:", error);
            setAdminRewardStatus("The address could not be copied. Please copy it manually.", "is-error");
        }
    }

    async function refreshAdminRewardDesk(message, className) {
        BlackwoodMembersState.adminRewardDeskOpen = true;
        BlackwoodMembersState.adminRewardRedemptions = await loadAdminRewardDashboardIfAllowed(
            BlackwoodMembersState.member
        );

        renderAdminRewardDeskInPlace();

        setAdminRewardStatus(message || "Reward desk refreshed.", className || "is-success");
    }

    function renderAdminRewardDeskInPlace() {
        const section = document.getElementById("circle-admin-reward-desk");

        if (!section) {
            return;
        }

        section.outerHTML = renderAdminRewardDesk();
        bindAdminRewardDeskEvents();

        document.querySelectorAll("[data-copy-discount-code]").forEach(function (button) {
            button.addEventListener("click", handleCopyDiscountCode);
        });
    }

    function setAdminRewardStatus(message, className) {
        const status = document.getElementById("circle-admin-reward-status");

        if (!status) {
            return;
        }

        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading");

        if (className) {
            status.classList.add(className);
        }
    }

    function setAdminRewardControlsDisabled(disabled) {
        document.querySelectorAll(
            "[data-admin-redemption-form] button, [data-admin-redemption-form] input, [data-admin-redemption-form] select, [data-admin-redemption-form] textarea, [data-admin-reward-filter]"
        ).forEach(function (element) {
            element.disabled = disabled;
        });
    }

    function getAdminRewardFormPayload(form, allowEmptyValues) {
        const discountCodeField = form.querySelector('[name="discount_code"]');
        const adminNoteField = form.querySelector('[name="admin_note"]');
        const deliveryStatusField = form.querySelector('[name="delivery_status"]');

        const discountCode = discountCodeField
            ? String(discountCodeField.value || "").trim()
            : "";

        const adminNote = adminNoteField
            ? String(adminNoteField.value || "").trim()
            : "";

        const deliveryStatus = deliveryStatusField
            ? normaliseAdminDeliveryStatus(deliveryStatusField.value || "")
            : "";

        return {
            discountCode: allowEmptyValues ? discountCode : (discountCode || null),
            adminNote: allowEmptyValues ? adminNote : (adminNote || null),
            deliveryStatus: deliveryStatus || null
        };
    }

    function getFilteredAdminRewardRedemptions() {
        const redemptions = Array.isArray(BlackwoodMembersState.adminRewardRedemptions)
            ? BlackwoodMembersState.adminRewardRedemptions
            : [];

        const filter = normaliseAdminRewardFilter(BlackwoodMembersState.adminRewardFilter);

        if (filter === "all") {
            return redemptions;
        }

        return redemptions.filter(function (redemption) {
            const status = normaliseRedemptionStatus(redemption.status);
            const deliveryStatus = normaliseAdminDeliveryStatus(redemption.delivery_status);

            if (filter === "pending") {
                return status === "pending";
            }

            if (filter === "address_needed") {
                return deliveryStatus === "address_required";
            }

            if (filter === "address_received") {
                return deliveryStatus === "address_received";
            }

            return status === filter;
        });
    }

    function getAdminRewardFilterCounts(redemptions) {
        const records = Array.isArray(redemptions) ? redemptions : [];

        return records.reduce(function (counts, redemption) {
            const status = normaliseRedemptionStatus(redemption.status);
            const deliveryStatus = normaliseAdminDeliveryStatus(redemption.delivery_status);

            counts.all += 1;

            if (status === "pending") counts.pending += 1;
            if (status === "issued") counts.issued += 1;
            if (status === "used") counts.used += 1;
            if (status === "cancelled") counts.cancelled += 1;
            if (deliveryStatus === "address_required") counts.address_needed += 1;
            if (deliveryStatus === "address_received") counts.address_received += 1;

            return counts;
        }, {
            all: 0,
            pending: 0,
            address_needed: 0,
            address_received: 0,
            issued: 0,
            used: 0,
            cancelled: 0
        });
    }

    function getAdminRewardRedemptionById(redemptionId) {
        return BlackwoodMembersState.adminRewardRedemptions.find(function (redemption) {
            return Number(redemption.redemption_id || 0) === Number(redemptionId || 0);
        }) || null;
    }

    function normaliseAdminRewardRedemption(redemption) {
        return {
            redemption_id: Number(redemption.redemption_id || redemption.id || 0),
            member_id: redemption.member_id || "",
            reader_name: String(redemption.reader_name || redemption.display_name || "").trim(),
            reader_email: String(redemption.reader_email || redemption.email || "").trim(),
            reward_id: Number(redemption.reward_id || 0),
            reward_title: String(redemption.reward_title || "").trim(),
            points_cost: Number(redemption.points_cost || 0),
            status: normaliseRedemptionStatus(redemption.status),
            discount_code: String(redemption.discount_code || "").trim(),
            admin_note: String(redemption.admin_note || "").trim(),
            requested_at: redemption.requested_at || "",
            issued_at: redemption.issued_at || "",
            used_at: redemption.used_at || "",
            cancelled_at: redemption.cancelled_at || "",
            created_at: redemption.created_at || "",
            delivery_status: normaliseAdminDeliveryStatus(redemption.delivery_status),
            delivery_name: String(redemption.delivery_name || "").trim(),
            delivery_address_line_1: String(redemption.delivery_address_line_1 || "").trim(),
            delivery_address_line_2: String(redemption.delivery_address_line_2 || "").trim(),
            delivery_city: String(redemption.delivery_city || "").trim(),
            delivery_region: String(redemption.delivery_region || "").trim(),
            delivery_postcode: String(redemption.delivery_postcode || "").trim(),
            delivery_country: String(redemption.delivery_country || "").trim(),
            delivery_note: String(redemption.delivery_note || "").trim(),
            delivery_submitted_at: redemption.delivery_submitted_at || "",
            fulfilment_state: String(redemption.fulfilment_state || "").trim()
        };
    }

    function normaliseAdminRewardFilter(value) {
        const cleanValue = String(value || "").trim().toLowerCase();

        const allowed = BLACKWOOD_ADMIN_REWARD_FILTERS.some(function (filter) {
            return filter.id === cleanValue;
        });

        return allowed ? cleanValue : "all";
    }

    function normaliseRedemptionStatus(value) {
        const cleanValue = String(value || "pending").trim().toLowerCase();

        if (["pending", "issued", "used", "cancelled"].includes(cleanValue)) {
            return cleanValue;
        }

        return "pending";
    }

    function normaliseAdminDeliveryStatus(value) {
        const cleanValue = String(value || "").trim().toLowerCase();

        if (["not_required", "address_required", "address_received", "posted", "fulfilled"].includes(cleanValue)) {
            return cleanValue;
        }

        return "";
    }

    function getAdminDeliveryStatusLabel(value) {
        const cleanValue = normaliseAdminDeliveryStatus(value);
        const option = BLACKWOOD_ADMIN_DELIVERY_STATUS_OPTIONS.find(function (item) {
            return item.value === cleanValue;
        });

        return option ? option.label : "Not set";
    }

    function isAdminPhysicalDeliveryReward(redemption) {
        return isPhysicalDeliveryReward(redemption);
    }

    function hasAdminDeliveryAddress(redemption) {
        if (!redemption) {
            return false;
        }

        return Boolean(
            redemption.delivery_name &&
            redemption.delivery_address_line_1 &&
            redemption.delivery_city &&
            redemption.delivery_postcode &&
            redemption.delivery_country
        );
    }

    function formatAdminDeliveryAddressHtml(redemption) {
        return getAdminDeliveryAddressLines(redemption).map(function (line) {
            return `<span>${escapeHtml(line)}</span>`;
        }).join("");
    }

    function formatAdminDeliveryAddressPlain(redemption) {
        const lines = [
            redemption.reader_name || "",
            redemption.reader_email || "",
            "",
            ...getAdminDeliveryAddressLines(redemption)
        ].filter(function (line, index, array) {
            if (line === "" && array[index - 1] === "") {
                return false;
            }

            return String(line || "").trim() || line === "";
        });

        return lines.join("\n").trim();
    }

    function getAdminDeliveryAddressLines(redemption) {
        const cityRegionLine = [
            redemption.delivery_city,
            redemption.delivery_region
        ].filter(Boolean).join(", ");

        return [
            redemption.delivery_name,
            redemption.delivery_address_line_1,
            redemption.delivery_address_line_2,
            cityRegionLine,
            redemption.delivery_postcode,
            redemption.delivery_country
        ].filter(function (line) {
            return String(line || "").trim();
        });
    }
    // =========================
// PREMIUM DISCLOSURE PANELS
// =========================

function renderPremiumDisclosure(options) {
    const panelId = String(options.panelId || "").trim();
    const title = String(options.title || "").trim();
    const kicker = String(options.kicker || "").trim();
    const summary = String(options.summary || "").trim();
    const countLabel = String(options.countLabel || "").trim();
    const bodyHtml = String(options.bodyHtml || "");
    const isOpen = options.isOpen === true;

    const contentId = `${panelId}-content`;

    return `
        <section
    id="circle-panel-${escapeAttribute(panelId)}"
    class="circle-premium-disclosure ${isOpen ? "is-open" : ""}"
    data-premium-disclosure="${escapeAttribute(panelId)}"
>
            <button
                type="button"
                class="circle-premium-disclosure-toggle"
                data-premium-disclosure-toggle="${escapeAttribute(panelId)}"
                aria-expanded="${isOpen ? "true" : "false"}"
                aria-controls="${escapeAttribute(contentId)}"
            >
                <span class="circle-premium-disclosure-heading">
                    ${
                        kicker
                            ? `<small>${escapeHtml(kicker)}</small>`
                            : ""
                    }

                    <span class="circle-premium-disclosure-title">
                        ${escapeHtml(title)}
                    </span>

                    ${
                        summary
                            ? `
                                <span class="circle-premium-disclosure-summary">
                                    ${escapeHtml(summary)}
                                </span>
                            `
                            : ""
                    }
                </span>

                <span class="circle-premium-disclosure-side">
                    ${
                        countLabel
                            ? `
                                <span class="circle-premium-disclosure-count">
                                    ${escapeHtml(countLabel)}
                                </span>
                            `
                            : ""
                    }

                    <span
                        class="circle-premium-disclosure-chevron"
                        aria-hidden="true"
                    >
                        ↓
                    </span>
                </span>
            </button>

            <div
                class="circle-premium-disclosure-body"
                id="${escapeAttribute(contentId)}"
                ${isOpen ? "" : "hidden"}
            >
                ${bodyHtml}
            </div>
        </section>
    `;
}

function bindPremiumDisclosurePanels() {
    document.querySelectorAll("[data-premium-disclosure-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
            const panelId = button.dataset.premiumDisclosureToggle || "";

            if (!panelId) {
                return;
            }

            const panel = document.querySelector(
                `[data-premium-disclosure="${panelId}"]`
            );

            if (!panel) {
                return;
            }

            const body = panel.querySelector(".circle-premium-disclosure-body");

            if (!body) {
                return;
            }

            const isOpen = !panel.classList.contains("is-open");

            panel.classList.toggle("is-open", isOpen);
            body.hidden = !isOpen;

            button.setAttribute("aria-expanded", String(isOpen));

            if (
                BlackwoodMembersState.premiumDisclosures &&
                Object.prototype.hasOwnProperty.call(
                    BlackwoodMembersState.premiumDisclosures,
                    panelId
                )
            ) {
                BlackwoodMembersState.premiumDisclosures[panelId] = isOpen;
            }
        });
    });
}

function bindPremiumDisclosureShortcuts() {
    document.querySelectorAll("[data-circle-open-panel]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            const panelId = link.dataset.circleOpenPanel || "";

            if (!panelId) {
                return;
            }

            const panel = document.querySelector(
                `[data-premium-disclosure="${panelId}"]`
            );

            if (!panel) {
                return;
            }

            const button = panel.querySelector(
                "[data-premium-disclosure-toggle]"
            );

            const body = panel.querySelector(
                ".circle-premium-disclosure-body"
            );

            if (!button || !body) {
                return;
            }

            event.preventDefault();

            panel.classList.add("is-open");
            body.hidden = false;
            button.setAttribute("aria-expanded", "true");

            if (
                BlackwoodMembersState.premiumDisclosures &&
                Object.prototype.hasOwnProperty.call(
                    BlackwoodMembersState.premiumDisclosures,
                    panelId
                )
            ) {
                BlackwoodMembersState.premiumDisclosures[panelId] = true;
            }

            const prefersReducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;

            panel.scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "start"
            });
        });
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

    function renderBehindFilesCarousel() {
    const posts = getBehindFilesForDisplay();

    if (!posts.length) {
        return renderPremiumDisclosure({
            panelId: "behindFiles",
            kicker: "Private Dispatches",
            title: "Behind the Files",
            summary: "Private Blackwood dispatches will appear here once filed.",
            countLabel: "0 files",
            isOpen: BlackwoodMembersState.premiumDisclosures.behindFiles,
            bodyHtml: `
                <article class="circle-empty-card">
                    <p>No Behind the Files updates have been filed yet.</p>
                </article>
            `
        });
    }

        BlackwoodMembersState.behindFilesIndex = clampBehindFilesIndex(
            BlackwoodMembersState.behindFilesIndex,
            posts
        );

        const post = posts[BlackwoodMembersState.behindFilesIndex];
        const hasMultiplePosts = posts.length > 1;

        const latestDate = formatBehindFileDate(post.publishedAt);

return renderPremiumDisclosure({
    panelId: "behindFiles",
    kicker: "Private Dispatches",
    title: "Behind the Files",
    summary: `${posts.length} private dispatch${posts.length === 1 ? "" : "es"} · Latest ${latestDate}`,
    countLabel: `${posts.length} filed`,
    isOpen: BlackwoodMembersState.premiumDisclosures.behindFiles,
    bodyHtml: `
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
                                aria-label="Earlier dispatch"
                                ${hasMultiplePosts ? "" : "disabled"}
                            >
                                &lt;
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
                                aria-label="Later dispatch"
                                ${hasMultiplePosts ? "" : "disabled"}
                            >
                                &gt;
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
    `
});
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

        if (image) image.src = post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage;
        if (category) category.textContent = post.category;
        if (date) date.textContent = formatBehindFileDate(post.publishedAt);
        if (pinned) pinned.hidden = !post.pinned;
        if (title) title.textContent = post.title;
        if (excerpt) excerpt.textContent = post.excerpt || "Open this file to read the full dispatch.";
        if (position) position.textContent = `${BlackwoodMembersState.behindFilesIndex + 1} of ${posts.length}`;

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

        if (modalImage) modalImage.src = post.image || BLACKWOOD_MEMBERS_CONFIG.behindFilesFallbackImage;
        if (modalCategory) modalCategory.textContent = post.category;
        if (modalDate) modalDate.textContent = formatBehindFileDate(post.publishedAt);
        if (modalPinned) modalPinned.hidden = !post.pinned;
        if (modalTitle) modalTitle.textContent = post.title;

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

    // =========================
    // REWARDS / REDEMPTIONS / POINTS
    // =========================

    function renderRewardsDisclosure(pointsTotal) {
    const rewardSummary = getRewardsDashboardSummary(pointsTotal);

    const unlockedCount = BlackwoodMembersState.rewards.filter(function (reward) {
        return pointsTotal >= Number(reward.points_required || 0);
    }).length;

    return renderPremiumDisclosure({
        panelId: "rewards",
        kicker: "Circle Rewards",
        title: "Rewards",
        summary: `${rewardSummary.headline} · ${rewardSummary.detail}`,
        countLabel: `${unlockedCount} unlocked`,
        isOpen: BlackwoodMembersState.premiumDisclosures.rewards,
        bodyHtml: `
            <div class="circle-reward-list">
                ${renderRewards(pointsTotal)}
            </div>
        `
    });
}

function renderRedemptionsDisclosure() {
    const summary = getRedemptionDashboardSummary();
    const redemptionCount = BlackwoodMembersState.redemptions.length;

    return renderPremiumDisclosure({
        panelId: "redemptions",
        kicker: "Reward Archive",
        title: "Redemptions",
        summary: `${summary.headline} · ${summary.detail}`,
        countLabel: redemptionCount === 1
            ? "1 filed"
            : `${redemptionCount} filed`,
        isOpen: BlackwoodMembersState.premiumDisclosures.redemptions,
        bodyHtml: `
            <div class="circle-reward-list">
                ${renderRedemptions()}
            </div>
        `
    });
}

function renderPointsDisclosure(pointsTotal) {
    const entryCount = BlackwoodMembersState.points.length;

    return renderPremiumDisclosure({
        panelId: "points",
        kicker: "Reader Record",
        title: "Points History",
        summary: `${pointsTotal} Circle points currently filed`,
        countLabel: entryCount === 1
            ? "1 entry"
            : `${entryCount} entries`,
        isOpen: BlackwoodMembersState.premiumDisclosures.points,
        bodyHtml: `
            <div class="circle-points-list">
                ${renderPointsHistory()}
            </div>
        `
    });
}

  
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
                label: latestRedemption.discount_code ? "Code Issued" : "Reward Issued",
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
                    <p>Your reward request is waiting to be reviewed. Physical rewards may require a delivery address.</p>
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
                        <p>Your reward has been issued. No discount code is required for this reward.</p>
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

                    ${renderRedemptionDeliveryAddress(redemption)}

                    ${renderRedemptionCodeOrStatus(redemption)}
                </article>
            `;
        }).join("");
    }

    function renderRedemptionCodeOrStatus(redemption) {
        if (redemption.discount_code) {
            return `
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
            `;
        }

        if (isPhysicalDeliveryReward(redemption)) {
            return "";
        }

        return `
            <p class="circle-muted-line">
                ${escapeHtml(getRedemptionPendingText(redemption))}
            </p>
        `;
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
            
                document.querySelectorAll("[data-redemption-address-form]").forEach(function (form) {
                    form.addEventListener("submit", handleRedemptionAddressSubmit);
                });
            
                bindMemberArcProfile();
                bindBlackwoodBookshelf();
                bindAdminRewardDeskEvents();
                bindBehindFilesCarousel();
                bindPremiumDisclosurePanels();
                bindPremiumDisclosureShortcuts();
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
            `Redeem "${rewardTitle}" for ${pointsCost} points?\n\nYour points will be deducted and the reward will be issued manually. Physical rewards may require a delivery address.`
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
                "Reward requested. It will be issued manually once reviewed.",
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

        const status = String(redemption.status || "").toLowerCase();

        return status === "pending" || status === "issued";
    }

    function renderRedemptionDeliveryAddress(redemption) {
        if (!isPhysicalDeliveryReward(redemption)) {
            return "";
        }

        const redemptionId = Number(redemption.id || redemption.redemption_id || 0);
        const status = String(redemption.status || "").toLowerCase();
        const canCollectAddress = status === "pending" || status === "issued";
        const addressReceived = hasDeliveryAddress(redemption);

        if (addressReceived) {
            return `
                <div class="circle-delivery-summary is-received">
                    <strong>Delivery address received</strong>

                    <address>
                        ${formatDeliveryAddress(redemption)}
                    </address>

                    <p>
                        This address will only be used to fulfil this Blackwood Circle reward.
                    </p>
                </div>
            `;
        }

        if (!canCollectAddress || !redemptionId) {
            return "";
        }

        return `
            <form
                class="circle-delivery-form"
                data-redemption-address-form="${redemptionId}"
                novalidate
            >
                <div class="circle-delivery-heading">
                    <strong>Delivery address required</strong>
                    <p>
                        This reward needs a postal address before it can be fulfilled.
                        Your address is stored against this reward request only.
                    </p>
                </div>

                <div class="circle-delivery-grid">
                    <label>
                        Delivery name
                        <input
                            type="text"
                            name="delivery_name"
                            autocomplete="name"
                            value="${escapeAttribute(getSuggestedDeliveryName())}"
                            required
                        >
                    </label>

                    <label>
                        Address line 1
                        <input
                            type="text"
                            name="delivery_address_line_1"
                            autocomplete="address-line1"
                            required
                        >
                    </label>

                    <label>
                        Address line 2
                        <input
                            type="text"
                            name="delivery_address_line_2"
                            autocomplete="address-line2"
                        >
                    </label>

                    <label>
                        Town / city
                        <input
                            type="text"
                            name="delivery_city"
                            autocomplete="address-level2"
                            required
                        >
                    </label>

                    <label>
                        County / region
                        <input
                            type="text"
                            name="delivery_region"
                            autocomplete="address-level1"
                        >
                    </label>

                    <label>
                        Postcode
                        <input
                            type="text"
                            name="delivery_postcode"
                            autocomplete="postal-code"
                            required
                        >
                    </label>

                    <label>
                        Country
                        <input
                            type="text"
                            name="delivery_country"
                            autocomplete="country-name"
                            value="${escapeAttribute(getSuggestedDeliveryCountry())}"
                            required
                        >
                    </label>

                    <label class="circle-delivery-note-field">
                        Delivery note
                        <textarea
                            name="delivery_note"
                            rows="3"
                            maxlength="500"
                            placeholder="Optional delivery note"
                        ></textarea>
                    </label>
                </div>

                <button type="submit" class="circle-button circle-button-primary">
                    Submit Delivery Address
                </button>

                <p class="circle-delivery-status" data-redemption-address-status aria-live="polite"></p>
            </form>
        `;
    }

    async function handleRedemptionAddressSubmit(event) {
        event.preventDefault();

        if (BlackwoodMembersState.isSubmittingDeliveryAddress) {
            return;
        }

        const form = event.currentTarget;
        const redemptionId = Number(form.dataset.redemptionAddressForm || 0);
        const submitButton = form.querySelector("button[type='submit']");

        const deliveryName = getFormFieldValue(form, "delivery_name");
        const addressLine1 = getFormFieldValue(form, "delivery_address_line_1");
        const addressLine2 = getFormFieldValue(form, "delivery_address_line_2");
        const city = getFormFieldValue(form, "delivery_city");
        const region = getFormFieldValue(form, "delivery_region");
        const postcode = getFormFieldValue(form, "delivery_postcode");
        const country = getFormFieldValue(form, "delivery_country");
        const deliveryNote = getFormFieldValue(form, "delivery_note");

        if (!redemptionId) {
            setRedemptionAddressStatus(form, "This reward request could not be found.", "is-error");
            return;
        }

        if (!deliveryName) {
            setRedemptionAddressStatus(form, "Please enter a delivery name.", "is-error");
            return;
        }

        if (!addressLine1) {
            setRedemptionAddressStatus(form, "Please enter address line 1.", "is-error");
            return;
        }

        if (!city) {
            setRedemptionAddressStatus(form, "Please enter a town or city.", "is-error");
            return;
        }

        if (!postcode) {
            setRedemptionAddressStatus(form, "Please enter a postcode.", "is-error");
            return;
        }

        if (!country) {
            setRedemptionAddressStatus(form, "Please enter a country.", "is-error");
            return;
        }

        if (deliveryNote.length > 500) {
            setRedemptionAddressStatus(form, "Delivery note must be 500 characters or fewer.", "is-error");
            return;
        }

        const originalButtonText = submitButton ? submitButton.textContent : "";

        BlackwoodMembersState.isSubmittingDeliveryAddress = true;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Saving Address...";
        }

        setRedemptionAddressStatus(form, "Saving delivery address...", "is-loading");

        try {
            const { error } = await BlackwoodMembersState.client.rpc(
                "submit_redemption_delivery_address",
                {
                    p_redemption_id: redemptionId,
                    p_delivery_name: deliveryName,
                    p_address_line_1: addressLine1,
                    p_address_line_2: addressLine2,
                    p_city: city,
                    p_region: region,
                    p_postcode: postcode,
                    p_country: country,
                    p_delivery_note: deliveryNote
                }
            );

            if (error) {
                throw error;
            }

            setRedemptionAddressStatus(form, "Delivery address received.", "is-success");

            await loadMemberDashboard();

        } catch (error) {
            console.error("Delivery address submission failed:", error);
            setRedemptionAddressStatus(form, cleanSupabaseError(error.message), "is-error");

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText || "Submit Delivery Address";
            }

        } finally {
            BlackwoodMembersState.isSubmittingDeliveryAddress = false;
        }
    }

    function isPhysicalDeliveryReward(redemption) {
        const title = String(redemption && redemption.reward_title ? redemption.reward_title : "")
            .toLowerCase();

        return (
            title.includes("bookmark") ||
            title.includes("archive insert") ||
            title.includes("collector reward") ||
            title.includes("limited edition")
        );
    }

    function hasDeliveryAddress(redemption) {
        if (!redemption) {
            return false;
        }

        const deliveryStatus = String(redemption.delivery_status || "").toLowerCase();

        if (deliveryStatus === "address_received" || redemption.delivery_submitted_at) {
            return true;
        }

        return Boolean(
            redemption.delivery_name &&
            redemption.delivery_address_line_1 &&
            redemption.delivery_city &&
            redemption.delivery_postcode &&
            redemption.delivery_country
        );
    }

    function formatDeliveryAddress(redemption) {
        const cityRegionLine = [
            redemption.delivery_city,
            redemption.delivery_region
        ].filter(Boolean).join(", ");

        const lines = [
            redemption.delivery_name,
            redemption.delivery_address_line_1,
            redemption.delivery_address_line_2,
            cityRegionLine,
            redemption.delivery_postcode,
            redemption.delivery_country
        ].filter(function (line) {
            return String(line || "").trim();
        });

        return lines.map(function (line) {
            return `<span>${escapeHtml(line)}</span>`;
        }).join("");
    }

    function getSuggestedDeliveryName() {
        const member = BlackwoodMembersState.member || {};

        return member.display_name || member.reader_name || "";
    }

    function getSuggestedDeliveryCountry() {
        const member = BlackwoodMembersState.member || {};

        return member.country || "";
    }

    function getFormFieldValue(form, name) {
        const field = form.querySelector(`[name="${name}"]`);

        return field ? String(field.value || "").trim() : "";
    }

    function setRedemptionAddressStatus(form, message, className) {
        const status = form.querySelector("[data-redemption-address-status]");

        if (!status) {
            return;
        }

        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading");

        if (className) {
            status.classList.add(className);
        }
    }

    function getRedemptionPendingText(redemption) {
        const status = String(redemption && redemption.status ? redemption.status : "pending").toLowerCase();

        if (isPhysicalDeliveryReward(redemption)) {
            if (hasDeliveryAddress(redemption)) {
                return status === "issued"
                    ? "Reward issued. Delivery details have been received."
                    : "Delivery details received. Reward pending manual fulfilment.";
            }

            return "Reward pending manual fulfilment.";
        }

        if (status === "issued" && !redemption.discount_code) {
            return "Reward issued. No discount code is required for this reward.";
        }

        return "Discount code pending manual issue.";
    }

    // =========================
    // GENERAL HELPERS
    // =========================

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

        const homePointsTotal = document.getElementById("circle-home-points-total");

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

        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading");

        if (className) {
            status.classList.add(className);
        }
    }

    function setDashboardStatus(message, className) {
        const status = document.getElementById("circle-dashboard-status");

        if (!status) return;

        status.textContent = message || "";
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
            is_arc_member: false,
            is_admin: false
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

        if (/admin access required/i.test(cleaned)) {
            return "Admin access is required for this action.";
        }

        if (/reward redemption not found/i.test(cleaned)) {
            return "That reward redemption could not be found.";
        }

        if (/invalid redemption status/i.test(cleaned)) {
            return "That redemption status is not available.";
        }

        if (/invalid delivery status/i.test(cleaned)) {
            return "That delivery status is not available.";
        }

        if (/not available for redemption/i.test(cleaned)) {
            return "This reward is not currently available for redemption.";
        }

        if (/not enough points/i.test(cleaned)) {
            return "You do not have enough points for this reward.";
        }

        if (/already have this reward/i.test(cleaned) || /pending redemption request/i.test(cleaned)) {
            return "You already have a pending or issued redemption for this reward.";
        }

        if (/delivery name is required/i.test(cleaned)) {
            return "Please enter a delivery name.";
        }

        if (/address line 1 is required/i.test(cleaned)) {
            return "Please enter address line 1.";
        }

        if (/town or city is required/i.test(cleaned)) {
            return "Please enter a town or city.";
        }

        if (/postcode is required/i.test(cleaned)) {
            return "Please enter a postcode.";
        }

        if (/country is required/i.test(cleaned)) {
            return "Please enter a country.";
        }

        if (/delivery note is too long/i.test(cleaned)) {
            return "Delivery note must be 500 characters or fewer.";
        }

        if (/delivery address cannot be added/i.test(cleaned)) {
            return "This delivery address cannot be added to that reward.";
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
            setAdminRewardStatus("No discount code was found to copy.", "is-error");
            return;
        }

        const originalText = button.textContent;

        try {
            await copyTextToClipboard(code);

            button.textContent = "Copied";
            button.classList.add("is-copied");

            setDashboardStatus("Discount code copied to clipboard.", "is-success");
            setAdminRewardStatus("Discount code copied to clipboard.", "is-success");

            window.setTimeout(function () {
                button.textContent = originalText || "Copy Code";
                button.classList.remove("is-copied");
            }, 1600);

        } catch (error) {
            console.warn("Copy discount code failed:", error);
            setDashboardStatus("The code could not be copied. Please copy it manually.", "is-error");
            setAdminRewardStatus("The code could not be copied. Please copy it manually.", "is-error");
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
