
(function () {
    "use strict";

    const SUPABASE_URL = "https://bmnlynjldlnxfvunqbqq.supabase.co";
    const SUPABASE_KEY = "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

    if (!window.supabase || !window.supabase.createClient) {
        console.error("Supabase JavaScript library is not loaded.");
        return;
    }

    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    const $ = (id) => document.getElementById(id);

    const elements = {
        loadingPanel: $("loading-panel"),
        accessPanel: $("access-panel"),
        accessTitle: $("access-title"),
        accessMessage: $("access-message"),
        desk: $("desk"),
        authorName: $("author-name"),
        authorStatus: $("author-status"),
        welcomeHeading: $("welcome-heading"),
        bookCount: $("book-count"),
        relationshipSummary: $("relationship-summary"),
        overviewBookList: $("overview-book-list"),
        booksBookList: $("books-book-list"),
        productionContent: $("production-content"),
        documentsRightsContent: $("documents-rights-content"),
        statementCount: $("statement-count"),
        paymentCount: $("payment-count"),
        paymentRequestCount: $("payment-request-count"),
        statementList: $("statement-list"),
        paymentList: $("payment-list"),
        paymentRequestList: $("payment-request-list"),
        signOutButton: $("sign-out-button"),
        publishingDeskNav: $("publishing-desk-nav"),
        publishingAttentionList: $("publishing-attention-list")
    };

    const navButtons = Array.from(
        document.querySelectorAll(".nav-button")
    );

    const deskSections = Array.from(
        document.querySelectorAll(".desk-section")
    );

    let currentAuthor = null;
    let currentBooks = [];
    let currentMonthlyRoyalties = [];
    let monthlyRoyaltiesAvailable = false;

    navButtons.forEach((button) => {
        button.addEventListener("click", () => {
            showSection(button.dataset.section);
        });
    });

    $("overview-finance-button")?.addEventListener("click", () => {
        showSection("finance");
    });

    elements.signOutButton?.addEventListener(
        "click",
        handleSignOut
    );

    initialiseDesk();

    // ---------------------------------------------------------
    // INITIALISATION
    // ---------------------------------------------------------

    async function initialiseDesk() {
        try {
            const {
                data: { user },
                error: authError
            } = await client.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                showAccessMessage(
                    "Sign in required",
                    "You need to be signed in with an authorised Blackwood Publishing author account to open the Author Desk."
                );
                return;
            }

            const author = await loadAuthorRecord(user.id);

            if (!author) {
                showAccessMessage(
                    "Author Desk unavailable",
                    "This account does not currently have access to an Author Desk."
                );
                return;
            }

            currentAuthor = author;

            const [
                books,
                productionData,
                legalData,
                financeData,
                royaltyResult,
                staffResponse
            ] = await Promise.all([
                loadBooks(author.id),
                loadProductionData(author.id),
                loadLegalData(author.id),
                loadFinanceData(author.id),
                loadMonthlyRoyalties(),
                client
                    .from("publishing_staff")
                    .select("user_id,display_name,is_active")
                    .eq("user_id", user.id)
                    .maybeSingle()
            ]);

            currentBooks = books;
            currentMonthlyRoyalties = royaltyResult.rows;
            monthlyRoyaltiesAvailable = royaltyResult.available;

            if (
                !staffResponse.error &&
                staffResponse.data?.is_active === true
            ) {
                if (elements.publishingDeskNav) {
                    elements.publishingDeskNav.hidden = false;
                }

                await loadPublishingAttention();
            } else if (staffResponse.error) {
                console.error(
                    "Publishing Desk access check failed:",
                    staffResponse.error
                );
            }

            renderDesk(
                author,
                books,
                productionData,
                legalData,
                financeData
            );
        } catch (error) {
            console.error(
                "Author Desk failed to initialise:",
                error
            );

            showAccessMessage(
                "Author Desk could not be opened",
                "There was a problem loading your publishing records. Please try again."
            );
        }
    }

    async function loadAuthorRecord(userId) {
        const { data, error } = await client
            .from("author_records")
            .select(
                "id,publishing_name,email,relationship_status,desk_access_enabled"
            )
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;

        return data?.desk_access_enabled === true
            ? data
            : null;
    }

    async function getAuthorBookIds(authorId) {
        if (!authorId) {
            throw new Error("Author ID is required.");
        }

        const { data, error } = await client
            .from("book_contributors")
            .select("book_id")
            .eq("author_id", authorId)
            .eq("desk_visible", true);

        if (error) throw error;

        return [...new Set(
            (data || []).map((row) => row.book_id)
        )];
    }

    async function loadBooks(authorId) {
        const ids = await getAuthorBookIds(authorId);

        if (!ids.length) return [];

        const { data, error } = await client
            .from("book_records")
            .select(
                "id,internal_reference,title,subtitle,work_status,production_stage,acquired_on,contracted_on,created_at"
            )
            .in("id", ids)
            .order("id", { ascending: true });

        if (error) throw error;

        return data || [];
    }

    async function loadProductionData(authorId) {
        const ids = await getAuthorBookIds(authorId);

        if (!ids.length) {
            return {
                events: [],
                editions: [],
                actions: []
            };
        }

        const [events, editions, actions] = await Promise.all([
            client
                .from("production_events")
                .select(
                    "id,book_id,event_type,from_stage,to_stage,event_date,note,author_visible,created_at"
                )
                .in("book_id", ids)
                .eq("author_visible", true)
                .order("event_date", { ascending: false })
                .order("id", { ascending: false }),

            client
                .from("book_editions")
                .select(
                    "id,book_id,edition_reference,edition_name,format,isbn,publication_date,status,territory,language,list_price,currency,author_visible,created_at"
                )
                .in("book_id", ids)
                .eq("author_visible", true)
                .order("id", { ascending: true }),

            client
                .from("author_actions")
                .select(
                    "id,book_id,action_type,title,description,due_at,status,author_visible,completed_at,created_at,updated_at"
                )
                .in("book_id", ids)
                .eq("author_visible", true)
                .order("id", { ascending: true })
        ]);

        for (const response of [events, editions, actions]) {
            if (response.error) throw response.error;
        }

        return {
            events: events.data || [],
            editions: editions.data || [],
            actions: actions.data || []
        };
    }

    async function loadLegalData(authorId) {
        const [documents, agreements, rights] = await Promise.all([
            client
                .from("documents")
                .select(
                    "id,author_id,book_id,edition_id,document_type,title,version,storage_bucket,storage_path,mime_type,author_visible,requires_signature,signed_at,issued_at,supersedes_document_id,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .eq("author_visible", true)
                .order("id", { ascending: true }),

            client
                .from("agreements")
                .select(
                    "id,author_id,book_id,agreement_type,agreement_reference,title,agreement_date,effective_date,expiry_date,status,signed_document_id,summary_author,author_visible,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .eq("author_visible", true)
                .order("id", { ascending: true }),

            client
                .from("rights")
                .select(
                    "id,agreement_id,author_id,book_id,rights_reference,right_type,format_scope,territory,language,exclusivity,effective_date,expiry_date,status,summary_author,author_visible,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .eq("author_visible", true)
                .order("id", { ascending: true })
        ]);

        for (const response of [documents, agreements, rights]) {
            if (response.error) throw response.error;
        }

        const rightsRows = rights.data || [];
        const rightIds = rightsRows.map((right) => right.id);

        let rightsEvents = [];

        if (rightIds.length) {
            const { data, error } = await client
                .from("rights_events")
                .select(
                    "id,right_id,event_type,event_date,description_author,author_visible,document_id,created_at"
                )
                .in("right_id", rightIds)
                .eq("author_visible", true)
                .order("event_date", { ascending: false })
                .order("id", { ascending: false });

            if (error) throw error;

            rightsEvents = data || [];
        }

        return {
            documents: documents.data || [],
            agreements: agreements.data || [],
            rights: rightsRows,
            rightsEvents
        };
    }

    // ---------------------------------------------------------
    // MONTHLY AUTHOR ROYALTIES
    //
    // This RPC must be secured in PostgreSQL.
    // It must identify the author from auth.uid().
    // It must not expose publisher commission or gross income.
    // ---------------------------------------------------------

    async function loadMonthlyRoyalties() {
        const { data, error } = await client.rpc(
            "author_desk_monthly_royalties"
        );

        if (error) {
            console.error(
                "Monthly author royalties unavailable:",
                error
            );

            return {
                available: false,
                rows: []
            };
        }

        if (!Array.isArray(data)) {
            return {
                available: false,
                rows: []
            };
        }

        // Explicitly retain only author-facing fields.
        // This is display hygiene, NOT database security.
        const rows = data.map((row) => ({
            book_id: row.book_id,
            book_title: row.book_title || "Untitled book",
            royalty_month: row.royalty_month,
            net_units_sold: Number(row.net_units_sold) || 0,
            author_royalties_gbp:
                Number(row.author_royalties_gbp) || 0,
            currency: "GBP",
            reporting_status:
                row.reporting_status || "reported"
        }));

        rows.sort((a, b) => {
            const monthComparison = String(
                b.royalty_month || ""
            ).localeCompare(
                String(a.royalty_month || "")
            );

            return monthComparison ||
                a.book_title.localeCompare(b.book_title);
        });

        return {
            available: true,
            rows
        };
    }

    // ---------------------------------------------------------
    // EXISTING FINANCE RECORDS
    // ---------------------------------------------------------

    async function loadFinanceData(authorId) {
        const [
            statements,
            payments,
            requests,
            advances
        ] = await Promise.all([
            client
                .from("royalty_statements")
                .select(
                    "id,author_id,statement_reference,period_start,period_end,issue_date,currency,total_royalty_amount,total_adjustments,total_advance_applied,amount_payable,status,author_visible,supersedes_statement_id,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .order("issue_date", {
                    ascending: false,
                    nullsFirst: false
                })
                .order("id", { ascending: false }),

            client
                .from("payments")
                .select(
                    "id,author_id,payment_reference,currency,amount,status,requested_at,approved_at,processing_at,paid_at,failed_at,cancelled_at,payment_method_reference,author_visible,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .order("created_at", { ascending: false })
                .order("id", { ascending: false }),

            client
                .from("payment_requests")
                .select(
                    "id,author_id,request_reference,requested_amount,currency,status,requested_at,reviewed_at,fulfilled_at,payment_id,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .order("requested_at", { ascending: false })
                .order("id", { ascending: false }),

            client
                .from("advances")
                .select(
                    "id,agreement_id,author_id,book_id,advance_reference,currency,total_amount,status,agreed_date,summary_author,author_visible,created_at,updated_at"
                )
                .eq("author_id", authorId)
                .order("id", { ascending: true })
        ]);

        for (const response of [
            statements,
            payments,
            requests,
            advances
        ]) {
            if (response.error) throw response.error;
        }

        const statementRows = statements.data || [];
        const paymentRows = payments.data || [];

        const statementIds = statementRows.map((row) => row.id);
        const paymentIds = paymentRows.map((row) => row.id);

        const [lines, allocations] = await Promise.all([
            statementIds.length
                ? client
                    .from("royalty_statement_lines")
                    .select(
                        "id,statement_id,line_number,line_type,royalty_entry_id,royalty_adjustment_id,advance_id,description,amount,created_at"
                    )
                    .in("statement_id", statementIds)
                    .order("statement_id", { ascending: true })
                    .order("line_number", { ascending: true })
                : Promise.resolve({ data: [], error: null }),

            paymentIds.length
                ? client
                    .from("payment_allocations")
                    .select(
                        "id,payment_id,statement_id,amount,created_at"
                    )
                    .in("payment_id", paymentIds)
                    .order("id", { ascending: true })
                : Promise.resolve({ data: [], error: null })
        ]);

        if (lines.error) throw lines.error;
        if (allocations.error) throw allocations.error;

        return {
            statements: statementRows,
            statementLines: lines.data || [],
            payments: paymentRows,
            paymentAllocations: allocations.data || [],
            paymentRequests: requests.data || [],
            advances: advances.data || []
        };
    }

    async function refreshAuthorFinance() {
        const {
            data: { user },
            error
        } = await client.auth.getUser();

        if (error) throw error;

        if (!user || user.id !== currentAuthor?.id) {
            throw new Error(
                "Author session is no longer available."
            );
        }

        const financeData = await loadFinanceData(user.id);

        renderFinance(financeData);
        renderOverviewRoyalties(financeData);
    }

    // ---------------------------------------------------------
    // MAIN RENDERING
    // ---------------------------------------------------------

    function renderDesk(
        author,
        books,
        productionData,
        legalData,
        financeData
    ) {
        elements.loadingPanel.hidden = true;
        elements.accessPanel.hidden = true;
        elements.desk.hidden = false;

        const displayName =
            author.publishing_name || "Blackwood Author";

        setText(elements.authorName, displayName);
        setText(
            elements.authorStatus,
            formatLabel(author.relationship_status)
        );
        setText(
            elements.welcomeHeading,
            "Welcome, " + displayName
        );
        setText(elements.bookCount, books.length);
        setText(
            elements.relationshipSummary,
            formatLabel(author.relationship_status)
        );

        renderBookList(elements.overviewBookList, books);
        renderBookList(elements.booksBookList, books);
        renderProduction(books, productionData);
        renderDocumentsAndRights(books, legalData);
        renderFinance(financeData);
        renderOverviewRoyalties(financeData);
    }

    function renderBookList(container, books) {
        if (!container) return;

        container.replaceChildren();

        if (!books.length) {
            container.appendChild(
                createEmptyState(
                    "No Book Records are currently available in your Author Desk."
                )
            );
            return;
        }

        books.forEach((book) => {
            const card = make("article", "book-card");
            const top = make("div", "book-card-top");
            const titleGroup = make("div");
            const title = make(
                "h3",
                "book-title",
                book.title || "Untitled Book Record"
            );

            titleGroup.appendChild(title);

            if (book.subtitle) {
                titleGroup.appendChild(
                    make("p", "book-subtitle", book.subtitle)
                );
            }

            top.append(
                titleGroup,
                createStatusBadge(
                    formatLabel(book.production_stage)
                )
            );

            const meta = make("div", "book-meta");

            [
                ["Book Record", book.internal_reference],
                ["Work Status", formatLabel(book.work_status)],
                [
                    "Production Stage",
                    formatLabel(book.production_stage)
                ]
            ].forEach(([label, value]) => {
                meta.appendChild(createMetaItem(label, value));
            });

            card.append(top, meta);
            container.appendChild(card);
        });
    }

    // ---------------------------------------------------------
    // PRODUCTION
    // ---------------------------------------------------------

    function renderProduction(books, data) {
        const container = elements.productionContent;
        if (!container) return;

        container.replaceChildren();

        if (!books.length) {
            container.appendChild(
                createEmptyState(
                    "No production records are currently available in your Author Desk."
                )
            );
            return;
        }

        books.forEach((book) => {
            const events = data.events.filter(
                (row) => row.book_id === book.id
            );
            const editions = data.editions.filter(
                (row) => row.book_id === book.id
            );
            const actions = data.actions.filter(
                (row) => row.book_id === book.id
            );

            const wrapper = make("div", "production-book");
            const heading = make(
                "div",
                "production-book-heading"
            );

            heading.append(
                make("h3", "", book.title || "Untitled Book Record"),
                make(
                    "p",
                    "production-reference",
                    book.internal_reference || "Book Record"
                )
            );

            const summary = make("div", "production-summary");

            summary.append(
                createSummaryRecord(
                    "Current Stage",
                    formatLabel(book.production_stage),
                    "production-summary-card"
                ),
                createSummaryRecord(
                    "Work Status",
                    formatLabel(book.work_status),
                    "production-summary-card"
                )
            );

            wrapper.append(
                heading,
                summary,
                createActionsPanel(actions),
                createEditionsPanel(editions),
                createProductionHistoryPanel(events)
            );

            container.appendChild(wrapper);
        });
    }

    function createActionsPanel(actions) {
        const panel = createContentPanel(
            "Author Actions",
            "Current actions and information recorded for you during production."
        );

        if (!actions.length) {
            panel.appendChild(
                createEmptyState(
                    "No author actions are currently recorded."
                )
            );
            return panel;
        }

        const list = make("div", "action-list");

        actions.forEach((action) => {
            const card = make("article", "action-card");
            const top = make("div", "action-card-top");

            top.append(
                make(
                    "h4",
                    "record-title",
                    action.title || formatLabel(action.action_type)
                ),
                createStatusBadge(formatLabel(action.status))
            );

            card.appendChild(top);

            if (action.description) {
                card.appendChild(
                    make(
                        "p",
                        "record-description",
                        action.description
                    )
                );
            }

            const meta = make("div", "record-meta");

            if (action.due_at) {
                meta.appendChild(
                    createInlineMeta(
                        "Due",
                        formatDate(action.due_at)
                    )
                );
            }

            if (action.completed_at) {
                meta.appendChild(
                    createInlineMeta(
                        "Completed",
                        formatDate(action.completed_at)
                    )
                );
            }

            if (meta.childElementCount) {
                card.appendChild(meta);
            }

            list.appendChild(card);
        });

        panel.appendChild(list);
        return panel;
    }

    function createEditionsPanel(editions) {
        const panel = createContentPanel(
            "Editions",
            "Edition records currently associated with this Book Record."
        );

        if (!editions.length) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible editions are currently recorded."
                )
            );
            return panel;
        }

        const list = make("div", "edition-list");

        editions.forEach((edition) => {
            const card = make("article", "edition-card");
            const top = make("div", "edition-card-top");

            top.append(
                make(
                    "h4",
                    "record-title",
                    edition.edition_name ||
                        formatLabel(edition.format)
                ),
                createStatusBadge(formatLabel(edition.status))
            );

            card.appendChild(top);

            const meta = make("div", "record-meta");

            meta.appendChild(
                createInlineMeta(
                    "Format",
                    formatLabel(edition.format)
                )
            );

            if (edition.publication_date) {
                meta.appendChild(
                    createInlineMeta(
                        "Publication",
                        formatDate(edition.publication_date)
                    )
                );
            }

            if (edition.isbn) {
                meta.appendChild(
                    createInlineMeta("ISBN", edition.isbn)
                );
            }

            if (
                edition.list_price != null &&
                edition.currency
            ) {
                meta.appendChild(
                    createInlineMeta(
                        "List price",
                        formatMoney(
                            edition.list_price,
                            edition.currency
                        )
                    )
                );
            }

            if (edition.edition_reference) {
                meta.appendChild(
                    createInlineMeta(
                        "Edition Record",
                        edition.edition_reference
                    )
                );
            }

            card.appendChild(meta);
            list.appendChild(card);
        });

        panel.appendChild(list);
        return panel;
    }

    function createProductionHistoryPanel(events) {
        const panel = createContentPanel(
            "Production History",
            "Author-visible milestones recorded against this Book Record."
        );

        if (!events.length) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible production history is currently recorded."
                )
            );
            return panel;
        }

        const timeline = make("div", "timeline");

        events.forEach((event) => {
            const item = make("article", "timeline-item");

            item.append(
                make(
                    "p",
                    "timeline-date",
                    formatDate(event.event_date)
                ),
                make(
                    "h4",
                    "timeline-title",
                    formatLabel(
                        event.to_stage || event.event_type
                    )
                )
            );

            if (event.from_stage && event.to_stage) {
                item.appendChild(
                    make(
                        "p",
                        "record-description",
                        formatLabel(event.from_stage) +
                            " → " +
                            formatLabel(event.to_stage)
                    )
                );
            }

            if (event.note) {
                item.appendChild(
                    make("p", "timeline-note", event.note)
                );
            }

            timeline.appendChild(item);
        });

        panel.appendChild(timeline);
        return panel;
    }

    // ---------------------------------------------------------
    // DOCUMENTS, AGREEMENTS AND RIGHTS
    // ---------------------------------------------------------

    function renderDocumentsAndRights(books, data) {
        const container = elements.documentsRightsContent;
        if (!container) return;

        container.replaceChildren();

        const generalDocuments = data.documents.filter(
            (row) => row.book_id == null
        );
        const generalAgreements = data.agreements.filter(
            (row) => row.book_id == null
        );
        const generalRights = data.rights.filter(
            (row) => row.book_id == null
        );

        if (
            generalDocuments.length ||
            generalAgreements.length ||
            generalRights.length
        ) {
            container.appendChild(
                createLegalGroup(
                    "General publishing records",
                    "Author-visible records associated with your publishing relationship rather than one particular Book Record.",
                    generalDocuments,
                    generalAgreements,
                    generalRights,
                    data.rightsEvents
                )
            );
        }

        books.forEach((book) => {
            container.appendChild(
                createLegalGroup(
                    book.title || "Untitled Book Record",
                    book.internal_reference || "Book Record",
                    data.documents.filter(
                        (row) => row.book_id === book.id
                    ),
                    data.agreements.filter(
                        (row) => row.book_id === book.id
                    ),
                    data.rights.filter(
                        (row) => row.book_id === book.id
                    ),
                    data.rightsEvents,
                    true
                )
            );
        });

        if (!container.childElementCount) {
            container.appendChild(
                createEmptyState(
                    "No author-visible documents, agreements or rights records are currently available."
                )
            );
        }
    }

    function createLegalGroup(
        title,
        intro,
        documents,
        agreements,
        rights,
        rightsEvents,
        isBook = false
    ) {
        const wrapper = make("div", "legal-book");
        const heading = make("div", "legal-book-heading");

        heading.append(
            make("h3", "", title),
            make(
                "p",
                isBook ? "legal-reference" : "panel-intro",
                intro
            )
        );

        wrapper.appendChild(heading);

        if (isBook) {
            const summary = make("div", "legal-summary");

            summary.append(
                createSummaryRecord(
                    "Documents",
                    String(documents.length),
                    "legal-summary-card"
                ),
                createSummaryRecord(
                    "Rights Records",
                    String(rights.length),
                    "legal-summary-card"
                )
            );

            wrapper.appendChild(summary);
        }

        wrapper.append(
            createDocumentsPanel(documents),
            createAgreementsPanel(agreements),
            createRightsPanel(rights, rightsEvents)
        );

        return wrapper;
    }

    function createDocumentsPanel(documents) {
        const panel = createContentPanel(
            "Documents",
            "Author-visible publishing documents associated with this record."
        );

        if (!documents.length) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible documents are currently recorded."
                )
            );
            return panel;
        }

        const list = make("div", "record-list");

        documents.forEach((record) => {
            const card = make("article", "record-card");
            const top = make("div", "record-card-top");

            top.appendChild(
                make(
                    "h4",
                    "record-title",
                    record.title ||
                        formatLabel(record.document_type)
                )
            );

            if (record.requires_signature) {
                top.appendChild(
                    createStatusBadge(
                        record.signed_at
                            ? "Signed"
                            : "Signature Required"
                    )
                );
            }

            card.appendChild(top);

            const meta = make("div", "record-meta");

            appendMeta(meta, "Type", formatLabel(record.document_type));
            appendMeta(meta, "Version", record.version);

            if (record.issued_at) {
                appendMeta(
                    meta,
                    "Issued",
                    formatDate(record.issued_at)
                );
            }

            if (record.signed_at) {
                appendMeta(
                    meta,
                    "Signed",
                    formatDate(record.signed_at)
                );
            }

            card.appendChild(meta);
            list.appendChild(card);
        });

        panel.appendChild(list);
        return panel;
    }

    function createAgreementsPanel(agreements) {
        const panel = createContentPanel(
            "Agreements",
            "Author-visible agreements forming part of the publishing record."
        );

        if (!agreements.length) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible agreements are currently recorded."
                )
            );
            return panel;
        }

        const list = make("div", "record-list");

        agreements.forEach((agreement) => {
            const card = make("article", "record-card");
            const top = make("div", "record-card-top");

            top.append(
                make(
                    "h4",
                    "record-title",
                    agreement.title ||
                        formatLabel(agreement.agreement_type)
                ),
                createStatusBadge(formatLabel(agreement.status))
            );

            card.appendChild(top);

            if (agreement.summary_author) {
                card.appendChild(
                    make(
                        "p",
                        "record-description",
                        agreement.summary_author
                    )
                );
            }

            const meta = make("div", "record-meta");

            appendMeta(
                meta,
                "Agreement Record",
                agreement.agreement_reference
            );
            appendMeta(
                meta,
                "Type",
                formatLabel(agreement.agreement_type)
            );

            for (const [label, field] of [
                ["Agreement date", "agreement_date"],
                ["Effective", "effective_date"],
                ["Expiry", "expiry_date"]
            ]) {
                if (agreement[field]) {
                    appendMeta(
                        meta,
                        label,
                        formatDate(agreement[field])
                    );
                }
            }

            card.appendChild(meta);
            list.appendChild(card);
        });

        panel.appendChild(list);
        return panel;
    }

    function createRightsPanel(rights, rightsEvents) {
        const panel = createContentPanel(
            "Rights",
            "Rights recorded as held by Blackwood under the relevant publishing agreement."
        );

        if (!rights.length) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible rights records are currently recorded."
                )
            );
            return panel;
        }

        const list = make("div", "record-list");

        rights.forEach((right) => {
            const card = make("article", "record-card");
            const top = make("div", "record-card-top");

            top.append(
                make(
                    "h4",
                    "record-title",
                    formatLabel(right.right_type)
                ),
                createStatusBadge(formatLabel(right.status))
            );

            card.appendChild(top);

            if (right.summary_author) {
                card.appendChild(
                    make(
                        "p",
                        "record-description",
                        right.summary_author
                    )
                );
            }

            const meta = make("div", "record-meta");

            appendMeta(meta, "Rights Record", right.rights_reference);
            appendMeta(
                meta,
                "Format",
                right.format_scope
                    ? formatLabel(right.format_scope)
                    : null
            );
            appendMeta(meta, "Territory", right.territory);
            appendMeta(meta, "Language", right.language);
            appendMeta(
                meta,
                "Exclusivity",
                formatLabel(right.exclusivity)
            );

            if (right.effective_date) {
                appendMeta(
                    meta,
                    "Effective",
                    formatDate(right.effective_date)
                );
            }

            if (right.expiry_date) {
                appendMeta(
                    meta,
                    "Expiry",
                    formatDate(right.expiry_date)
                );
            }

            card.appendChild(meta);

            const events = rightsEvents.filter(
                (event) => event.right_id === right.id
            );

            if (events.length) {
                const timeline = make("div", "timeline");

                events.forEach((event) => {
                    const item = make("div", "timeline-item");

                    item.append(
                        make(
                            "p",
                            "timeline-date",
                            formatDate(event.event_date)
                        ),
                        make(
                            "h5",
                            "timeline-title",
                            formatLabel(event.event_type)
                        )
                    );

                    if (event.description_author) {
                        item.appendChild(
                            make(
                                "p",
                                "timeline-note",
                                event.description_author
                            )
                        );
                    }

                    timeline.appendChild(item);
                });

                card.appendChild(timeline);
            }

            list.appendChild(card);
        });

        panel.appendChild(list);
        return panel;
    }

    // ---------------------------------------------------------
    // OVERVIEW: MONTHLY ROYALTIES + ISSUED ACCOUNT FIGURES
    // ---------------------------------------------------------

    function renderOverviewRoyalties(financeData) {
        const container = $("overview-royalty-summary");
        if (!container) return;

        container.replaceChildren();

        if (monthlyRoyaltiesAvailable) {
            const monthlyTotal = currentMonthlyRoyalties.reduce(
                (sum, row) => sum + row.author_royalties_gbp,
                0
            );

            const monthlyGrid = make(
                "div",
                "finance-summary-grid"
            );

            monthlyGrid.appendChild(
                createFinanceSummaryCard(
                    "Reported Author Royalties",
                    formatMoney(monthlyTotal, "GBP"),
                    "Your share of reported book royalties. These figures are not issued statements or an available payment balance."
                )
            );

            container.appendChild(monthlyGrid);
        } else {
            container.appendChild(
                createEmptyState(
                    "Monthly royalty reporting is not currently available."
                )
            );
        }

        const currencies = getFinanceCurrencies(
            financeData.statements.filter(
                (statement) => statement.status === "issued"
            ),
            financeData.payments,
            financeData.paymentRequests,
            financeData.advances
        );

        if (!currencies.length) {
            container.appendChild(
                createEmptyState(
                    "No issued royalty statements are currently available."
                )
            );
            return;
        }

        currencies.forEach((currency) => {
            const figures = calculateFinanceSummary(
                currency,
                financeData
            );

            const group = make(
                "div",
                "finance-account-currency"
            );

            if (currencies.length > 1) {
                group.appendChild(
                    make("h4", "", currency)
                );
            }

            const grid = make(
                "div",
                "finance-summary-grid"
            );

            grid.append(
                createFinanceSummaryCard(
                    "Royalties on Issued Statements",
                    formatMoney(
                        figures.royaltiesEarned,
                        currency
                    ),
                    "Royalties recorded on issued statements."
                ),
                createFinanceSummaryCard(
                    "Payments Made",
                    formatMoney(
                        figures.totalPayments,
                        currency
                    ),
                    "Payments recorded as paid."
                ),
                createFinanceSummaryCard(
                    "Payment Pending",
                    formatMoney(
                        figures.pendingPayment,
                        currency
                    ),
                    "Outstanding requests and payments being processed."
                )
            );

            group.appendChild(grid);
            container.appendChild(group);
        });
    }

    // ---------------------------------------------------------
    // FINANCE DASHBOARD
    // ---------------------------------------------------------

    function renderFinance(data) {
        setText(
            elements.statementCount,
            data.statements.length
        );
        setText(
            elements.paymentCount,
            data.payments.length
        );
        setText(
            elements.paymentRequestCount,
            data.paymentRequests.length
        );

        renderFinanceAccountSummary(data);
        renderMonthlyRoyalties();
        renderStatements(
            data.statements,
            data.statementLines
        );
        renderPayments(
            data.payments,
            data.paymentAllocations,
            data.statements
        );
        renderPaymentRequests(data.paymentRequests);
    }

    function renderMonthlyRoyalties() {
        $("author-monthly-royalties")?.remove();

        const panel = createContentPanel(
            "Monthly Book Royalties",
            "Your share of royalties reported by book and month. These are reporting figures, not issued statements or amounts available to withdraw."
        );

        panel.id = "author-monthly-royalties";

        if (!monthlyRoyaltiesAvailable) {
            panel.appendChild(
                createEmptyState(
                    "Monthly royalty reporting is not currently available."
                )
            );
        } else if (!currentMonthlyRoyalties.length) {
            panel.appendChild(
                createEmptyState(
                    "No monthly book royalties have been reported for your account."
                )
            );
        } else {
            const total = currentMonthlyRoyalties.reduce(
                (sum, row) => sum + row.author_royalties_gbp,
                0
            );

            const units = currentMonthlyRoyalties.reduce(
                (sum, row) => sum + row.net_units_sold,
                0
            );

            const summary = make(
                "div",
                "finance-summary-grid"
            );

            summary.append(
                createFinanceSummaryCard(
                    "Total Reported Author Royalties",
                    formatMoney(total, "GBP"),
                    "Your royalty share across all reported months."
                ),
                createFinanceSummaryCard(
                    "Net Units Reported",
                    new Intl.NumberFormat("en-GB").format(units),
                    "Net units in the royalty reports."
                )
            );

            panel.appendChild(summary);

            const byMonth = new Map();

            currentMonthlyRoyalties.forEach((row) => {
                const month = String(
                    row.royalty_month || "Unknown month"
                );

                if (!byMonth.has(month)) {
                    byMonth.set(month, []);
                }

                byMonth.get(month).push(row);
            });

            for (const [month, rows] of byMonth) {
                const monthGroup = make(
                    "div",
                    "finance-account-currency"
                );

                monthGroup.appendChild(
                    make(
                        "h4",
                        "record-title",
                        formatMonth(month)
                    )
                );

                const list = make("div", "record-list");

                rows.forEach((row) => {
                    const card = make(
                        "article",
                        "record-card"
                    );

                    const top = make(
                        "div",
                        "record-card-top"
                    );

                    top.append(
                        make(
                            "h5",
                            "record-title",
                            row.book_title
                        ),
                        createStatusBadge(
                            formatLabel(row.reporting_status)
                        )
                    );

                    const meta = make(
                        "div",
                        "record-meta"
                    );

                    meta.append(
                        createInlineMeta(
                            "Author royalties",
                            formatMoney(
                                row.author_royalties_gbp,
                                "GBP"
                            )
                        ),
                        createInlineMeta(
                            "Net units",
                            row.net_units_sold.toLocaleString("en-GB")
                        )
                    );

                    card.append(top, meta);
                    list.appendChild(card);
                });

                const monthTotal = rows.reduce(
                    (sum, row) =>
                        sum + row.author_royalties_gbp,
                    0
                );

                monthGroup.append(
                    list,
                    make(
                        "p",
                        "record-description",
                        "Monthly author royalty total: " +
                            formatMoney(monthTotal, "GBP")
                    )
                );

                panel.appendChild(monthGroup);
            }
        }

        const accountSummary = $("finance-account-summary");

        if (accountSummary?.parentNode) {
            accountSummary.parentNode.insertBefore(
                panel,
                accountSummary
            );
            return;
        }

        const statementsPanel =
            elements.statementList?.closest(".content-panel");

        if (statementsPanel?.parentNode) {
            statementsPanel.parentNode.insertBefore(
                panel,
                statementsPanel
            );
        } else {
            $("section-finance")?.appendChild(panel);
        }
    }

    function renderFinanceAccountSummary(data) {
        $("finance-account-summary")?.remove();

        const currencies = getFinanceCurrencies(
            data.statements.filter(
                (row) => row.status === "issued"
            ),
            data.payments,
            data.paymentRequests,
            data.advances
        );

        if (!currencies.length) return;

        const panel = createContentPanel(
            "Account Summary",
            "Issued royalties, advances and payments recorded against your author account."
        );

        panel.id = "finance-account-summary";

        const list = make(
            "div",
            "finance-account-summary"
        );

        currencies.forEach((currency) => {
            const figures = calculateFinanceSummary(
                currency,
                data
            );

            const group = make(
                "div",
                "finance-account-currency"
            );

            if (currencies.length > 1) {
                group.appendChild(
                    make(
                        "h4",
                        "record-title",
                        currency
                    )
                );
            }

            const grid = make(
                "div",
                "finance-summary-grid"
            );

            grid.append(
                createFinanceSummaryCard(
                    "Royalties Earned",
                    formatMoney(
                        figures.royaltiesEarned,
                        currency
                    ),
                    "Royalties recorded on issued statements before advance recoupment."
                ),
                createFinanceSummaryCard(
                    "Advance Remaining",
                    formatMoney(
                        figures.advanceRemaining,
                        currency
                    ),
                    figures.advanceRemaining > 0
                        ? "Royalties continue to reduce the unrecouped advance balance."
                        : "No unrecouped advance balance is currently recorded."
                ),
                createFinanceSummaryCard(
                    "Balance Due",
                    formatMoney(
                        figures.balanceDue,
                        currency
                    ),
                    figures.advanceRemaining > 0
                        ? "No royalty payment is due while royalties are being applied against an advance."
                        : "Issued payable royalties not reserved or allocated to a live payment."
                ),
                createFinanceSummaryCard(
                    "Pending Payment",
                    formatMoney(
                        figures.pendingPayment,
                        currency
                    ),
                    "Payment value currently requested, approved or processing."
                ),
                createFinanceSummaryCard(
                    "Total Payments",
                    formatMoney(
                        figures.totalPayments,
                        currency
                    ),
                    "Payments recorded as paid."
                )
            );

            group.append(
                grid,
                createPaymentRequestPanel(currency, figures)
            );

            list.appendChild(group);
        });

        panel.appendChild(list);

        const statementsPanel =
            elements.statementList?.closest(".content-panel");

        if (statementsPanel?.parentNode) {
            statementsPanel.parentNode.insertBefore(
                panel,
                statementsPanel
            );
        } else {
            $("section-finance")?.appendChild(panel);
        }
    }

    // ---------------------------------------------------------
    // FINANCE CALCULATIONS
    //
    // Payment eligibility is based ONLY on issued statements.
    // Monthly reporting is never added to the payable balance.
    // ---------------------------------------------------------

    function calculateFinanceSummary(currency, data) {
        const statements = data.statements.filter(
            (row) =>
                row.status === "issued" &&
                normaliseCurrency(row.currency) === currency
        );

        const advances = data.advances.filter(
            (row) =>
                normaliseCurrency(row.currency) === currency &&
                !["cancelled", "superseded"].includes(row.status)
        );

        const royaltiesEarned = sumValues(
            statements,
            "total_royalty_amount"
        );

        const advanceRemaining = Math.max(
            0,
            sumValues(advances, "total_amount") -
                sumValues(statements, "total_advance_applied")
        );

        const grossPayable = sumValues(
            statements,
            "amount_payable"
        );

        const livePaymentIds = new Set(
            data.payments
                .filter(
                    (payment) =>
                        normaliseCurrency(payment.currency) ===
                            currency &&
                        [
                            "approved",
                            "processing",
                            "paid",
                            "simulated"
                        ].includes(payment.status)
                )
                .map((payment) => payment.id)
        );

        const issuedStatementIds = new Set(
            statements.map((statement) => statement.id)
        );

        const allocatedAmount = data.paymentAllocations
            .filter(
                (allocation) =>
                    livePaymentIds.has(allocation.payment_id) &&
                    issuedStatementIds.has(allocation.statement_id)
            )
            .reduce(
                (total, allocation) =>
                    total + toNumber(allocation.amount),
                0
            );

        const reservedRequestAmount = sumValues(
            data.paymentRequests.filter(
                (request) =>
                    normaliseCurrency(request.currency) ===
                        currency &&
                    ["requested", "approved"].includes(
                        request.status
                    )
            ),
            "requested_amount"
        );

        const pendingPaymentAmount = sumValues(
            data.payments.filter(
                (payment) =>
                    normaliseCurrency(payment.currency) ===
                        currency &&
                    ["approved", "processing"].includes(
                        payment.status
                    )
            ),
            "amount"
        );

        const totalPayments = sumValues(
            data.payments.filter(
                (payment) =>
                    normaliseCurrency(payment.currency) ===
                        currency &&
                    payment.status === "paid"
            ),
            "amount"
        );

        return {
            royaltiesEarned,
            advanceRemaining,
            balanceDue:
                advanceRemaining > 0
                    ? 0
                    : Math.max(
                        0,
                        grossPayable -
                            allocatedAmount -
                            reservedRequestAmount
                    ),
            pendingPayment:
                pendingPaymentAmount + reservedRequestAmount,
            totalPayments
        };
    }

    function getFinanceCurrencies(
        statements,
        payments,
        requests,
        advances
    ) {
        const currencies = new Set();

        for (const records of [
            statements,
            payments,
            requests,
            advances
        ]) {
            records.forEach((record) => {
                const currency = normaliseCurrency(
                    record.currency
                );

                if (currency) currencies.add(currency);
            });
        }

        return [...currencies].sort();
    }

    // ---------------------------------------------------------
    // AUTHOR PAYMENT REQUESTS
    // ---------------------------------------------------------

    function createPaymentRequestPanel(currency, figures) {
        const panel = make(
            "div",
            "payment-request-control"
        );

        panel.appendChild(
            make("h4", "record-title", "Request Payment")
        );

        if (figures.advanceRemaining > 0) {
            panel.appendChild(
                make(
                    "p",
                    "record-description",
                    "Payment requests are not available while royalties are being applied against an unrecouped advance."
                )
            );
            return panel;
        }

        if (figures.balanceDue <= 0) {
            panel.appendChild(
                make(
                    "p",
                    "record-description",
                    "There is currently no balance available to request."
                )
            );
            return panel;
        }

        panel.appendChild(
            make(
                "p",
                "record-description",
                "You can request up to " +
                    formatMoney(figures.balanceDue, currency) +
                    "."
            )
        );

        const form = make(
            "form",
            "payment-request-form"
        );

        const field = make(
            "div",
            "payment-request-field"
        );

        const inputId =
            "payment-request-" + currency.toLowerCase();

        const label = make("label", "", "Amount");
        label.htmlFor = inputId;

        const input = document.createElement("input");

        Object.assign(input, {
            id: inputId,
            name: "amount",
            type: "number",
            min: "0.01",
            max: figures.balanceDue.toFixed(2),
            step: "0.01",
            value: figures.balanceDue.toFixed(2),
            required: true,
            inputMode: "decimal"
        });

        field.append(label, input);

        const button = make(
            "button",
            "payment-request-button",
            "Submit payment request"
        );
        button.type = "submit";

        const message = make(
            "p",
            "payment-request-message"
        );
        message.hidden = true;
        message.setAttribute("role", "status");

        form.append(field, button, message);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            clearPaymentRequestMessage(message);

            const amount = Number(input.value);

            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                Math.round(amount * 100) !== amount * 100
            ) {
                showPaymentRequestMessage(
                    message,
                    "Enter a valid amount in pounds and pence.",
                    true
                );
                return;
            }

            if (amount > figures.balanceDue) {
                showPaymentRequestMessage(
                    message,
                    "The requested amount cannot exceed the current balance due.",
                    true
                );
                return;
            }

            input.disabled = true;
            button.disabled = true;
            button.textContent = "Submitting…";

            try {
                const { error } = await client.rpc(
                    "create_payment_request",
                    {
                        p_requested_amount: amount,
                        p_currency: currency
                    }
                );

                if (error) throw error;

                await refreshAuthorFinance();
            } catch (error) {
                console.error(
                    "Payment request failed:",
                    error
                );

                input.disabled = false;
                button.disabled = false;
                button.textContent =
                    "Submit payment request";

                showPaymentRequestMessage(
                    message,
                    getPaymentRequestErrorMessage(error),
                    true
                );
            }
        });

        panel.appendChild(form);
        return panel;
    }

    async function handlePaymentRequestCancel(
        requestId,
        button,
        message
    ) {
        clearPaymentRequestMessage(message);

        button.disabled = true;
        button.textContent = "Cancelling…";

        try {
            const { error } = await client.rpc(
                "cancel_payment_request",
                { p_request_id: requestId }
            );

            if (error) throw error;

            await refreshAuthorFinance();
        } catch (error) {
            console.error(
                "Payment request cancellation failed:",
                error
            );

            button.disabled = false;
            button.textContent = "Cancel request";

            showPaymentRequestMessage(
                message,
                getPaymentRequestCancelErrorMessage(error),
                true
            );
        }
    }

    function getPaymentRequestErrorMessage(error) {
        const message = String(
            error?.message || ""
        ).toLowerCase();

        if (
            /available|balance|exceed/.test(message)
        ) {
            return "That amount is no longer available to request. Please refresh your Author Desk and try again.";
        }

        if (
            /desk|author|authenticated/.test(message)
        ) {
            return "Your Author Desk could not authorise this payment request. Please sign in again and retry.";
        }

        return "The payment request could not be submitted. No payment request has been created.";
    }

    function getPaymentRequestCancelErrorMessage(error) {
        const message = String(
            error?.message || ""
        ).toLowerCase();

        if (/requested|cancel/.test(message)) {
            return "This payment request can no longer be cancelled. Please refresh your Author Desk.";
        }

        if (/desk|author|authenticated/.test(message)) {
            return "Your Author Desk could not authorise this cancellation. Please sign in again and retry.";
        }

        return "The payment request could not be cancelled. No changes have been made.";
    }

    // ---------------------------------------------------------
    // STATEMENTS
    // ---------------------------------------------------------

    function renderStatements(statements, statementLines) {
        const container = elements.statementList;
        if (!container) return;

        container.replaceChildren();

        if (!statements.length) {
            container.appendChild(
                createEmptyState(
                    "No issued royalty statements are currently available."
                )
            );
            return;
        }

        statements.forEach((statement) => {
            const card = make("article", "record-card");

            card.appendChild(
                createRecordHeading(
                    statement.statement_reference ||
                        "Royalty Statement",
                    formatLabel(statement.status)
                )
            );

            const meta = make("div", "record-meta");

            if (statement.period_start && statement.period_end) {
                appendMeta(
                    meta,
                    "Period",
                    formatDate(statement.period_start) +
                        " – " +
                        formatDate(statement.period_end)
                );
            }

            if (statement.issue_date) {
                appendMeta(
                    meta,
                    "Issued",
                    formatDate(statement.issue_date)
                );
            }

            [
                ["Royalties", "total_royalty_amount"],
                ["Adjustments", "total_adjustments"],
                ["Advance applied", "total_advance_applied"],
                ["Amount payable", "amount_payable"]
            ].forEach(([label, field]) => {
                appendMeta(
                    meta,
                    label,
                    formatMoney(
                        statement[field],
                        statement.currency
                    )
                );
            });

            card.appendChild(meta);

            const lines = statementLines.filter(
                (line) => line.statement_id === statement.id
            );

            if (lines.length) {
                const list = make("div", "record-list");

                lines.forEach((line) => {
                    const lineCard = make(
                        "div",
                        "record-card"
                    );

                    lineCard.append(
                        createRecordHeading(
                            line.description ||
                                "Statement line " +
                                    line.line_number,
                            formatLabel(line.line_type),
                            "h5"
                        ),
                        createMetaRow([
                            [
                                "Amount",
                                formatMoney(
                                    line.amount,
                                    statement.currency
                                )
                            ]
                        ])
                    );

                    list.appendChild(lineCard);
                });

                card.appendChild(list);
            }

            container.appendChild(card);
        });
    }

    // ---------------------------------------------------------
    // PAYMENTS
    // ---------------------------------------------------------

    function renderPayments(
        payments,
        allocations,
        statements
    ) {
        const container = elements.paymentList;
        if (!container) return;

        container.replaceChildren();

        if (!payments.length) {
            container.appendChild(
                createEmptyState(
                    "No payments are currently recorded."
                )
            );
            return;
        }

        payments.forEach((payment) => {
            const card = make("article", "record-card");

            card.appendChild(
                createRecordHeading(
                    payment.payment_reference || "Payment",
                    payment.status === "simulated"
                        ? "Simulated — No Bank Transfer"
                        : formatLabel(payment.status)
                )
            );

            const meta = make("div", "record-meta");

            appendMeta(
                meta,
                "Amount",
                formatMoney(
                    payment.amount,
                    payment.currency
                )
            );

            for (const [label, field] of [
                ["Requested", "requested_at"],
                ["Approved", "approved_at"],
                ["Processing", "processing_at"],
                ["Paid", "paid_at"],
                ["Failed", "failed_at"],
                ["Cancelled", "cancelled_at"]
            ]) {
                if (payment[field]) {
                    appendMeta(
                        meta,
                        label,
                        formatDate(payment[field])
                    );
                }
            }

            card.appendChild(meta);

            const paymentAllocations = allocations.filter(
                (row) => row.payment_id === payment.id
            );

            if (paymentAllocations.length) {
                const list = make("div", "record-list");

                paymentAllocations.forEach((allocation) => {
                    const statement = statements.find(
                        (row) =>
                            row.id === allocation.statement_id
                    );

                    const allocationCard = make(
                        "div",
                        "record-card"
                    );

                    allocationCard.append(
                        make(
                            "h5",
                            "record-title",
                            statement?.statement_reference ||
                                "Statement allocation"
                        ),
                        createMetaRow([
                            [
                                "Allocated",
                                formatMoney(
                                    allocation.amount,
                                    payment.currency
                                )
                            ]
                        ])
                    );

                    list.appendChild(allocationCard);
                });

                card.appendChild(list);
            }

            container.appendChild(card);
        });
    }

    // ---------------------------------------------------------
    // PAYMENT REQUESTS AND BANK DETAILS
    // ---------------------------------------------------------

    function renderPaymentRequests(requests) {
        const container = elements.paymentRequestList;
        if (!container) return;

        container.replaceChildren();

        if (!requests.length) {
            container.appendChild(
                createEmptyState(
                    "No payment requests are currently recorded."
                )
            );
            return;
        }

        requests.forEach((request) => {
            const card = make("article", "record-card");

            card.appendChild(
                createRecordHeading(
                    request.request_reference ||
                        "Payment Request",
                    formatLabel(request.status)
                )
            );

            const meta = make("div", "record-meta");

            appendMeta(
                meta,
                "Amount",
                formatMoney(
                    request.requested_amount,
                    request.currency
                )
            );

            for (const [label, field] of [
                ["Requested", "requested_at"],
                ["Reviewed", "reviewed_at"],
                ["Fulfilled", "fulfilled_at"]
            ]) {
                if (request[field]) {
                    appendMeta(
                        meta,
                        label,
                        formatDate(request[field])
                    );
                }
            }

            card.appendChild(meta);

            if (request.status === "requested") {
                const details = make(
                    "div",
                    "payment-request-control"
                );

                details.appendChild(
                    createEmptyState(
                        "Checking payment details…"
                    )
                );

                card.appendChild(details);

                loadPaymentDetailsStatus(
                    request.id,
                    details
                );

                const actions = make(
                    "div",
                    "payment-request-actions"
                );

                const button = make(
                    "button",
                    "payment-request-button",
                    "Cancel request"
                );
                button.type = "button";

                const message = make(
                    "p",
                    "payment-request-message"
                );
                message.hidden = true;

                button.addEventListener("click", () => {
                    handlePaymentRequestCancel(
                        request.id,
                        button,
                        message
                    );
                });

                actions.append(button, message);
                card.appendChild(actions);
            }

            container.appendChild(card);
        });
    }

    async function loadPaymentDetailsStatus(
        requestId,
        container
    ) {
        try {
            const { data, error } = await client
                .from("payment_request_payment_details")
                .select("payment_request_id")
                .eq("payment_request_id", requestId)
                .maybeSingle();

            if (error) throw error;

            if (!container.isConnected) return;

            container.replaceChildren();

            if (data) {
                container.appendChild(
                    make(
                        "p",
                        "record-description",
                        "Bank details have been securely submitted for this payment request."
                    )
                );
            } else {
                container.appendChild(
                    createPaymentDetailsForm(requestId)
                );
            }
        } catch (error) {
            console.error(
                "Payment details status check failed:",
                error
            );

            if (!container.isConnected) return;

            container.replaceChildren(
                createEmptyState(
                    "Payment details could not be checked. Please refresh the Author Desk."
                )
            );
        }
    }

    function createPaymentDetailsForm(requestId) {
        const wrapper = make("div");

        wrapper.append(
            make("h4", "record-title", "Bank details"),
            make(
                "p",
                "record-description",
                "Enter the UK bank account details for this payment request."
            )
        );

        const form = make(
            "form",
            "payment-request-form"
        );

        const inputs = {};

        [
            {
                name: "accountHolder",
                label: "Account holder name",
                maxLength: 100,
                placeholder: "Account holder name"
            },
            {
                name: "sortCode",
                label: "Sort code",
                maxLength: 8,
                placeholder: "00-00-00"
            },
            {
                name: "accountNumber",
                label: "Account number",
                maxLength: 8,
                placeholder: "12345678"
            }
        ].forEach((definition) => {
            const field = make(
                "div",
                "payment-request-field"
            );

            const id =
                "bank-" +
                definition.name +
                "-" +
                requestId;

            const label = make(
                "label",
                "",
                definition.label
            );
            label.htmlFor = id;

            const input = document.createElement("input");

            Object.assign(input, {
                id,
                name: definition.name,
                type: "text",
                required: true,
                maxLength: definition.maxLength,
                placeholder: definition.placeholder,
                autocomplete: "off"
            });

            if (definition.name !== "accountHolder") {
                input.inputMode = "numeric";
                input.spellcheck = false;
            }

            inputs[definition.name] = input;

            field.append(label, input);
            form.appendChild(field);
        });

        const button = make(
            "button",
            "payment-request-button",
            "Save bank details"
        );
        button.type = "submit";

        const message = make(
            "p",
            "payment-request-message"
        );
        message.hidden = true;
        message.setAttribute("role", "status");

        form.append(button, message);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            clearPaymentRequestMessage(message);

            const accountHolder =
                inputs.accountHolder.value.trim();

            const sortCode =
                inputs.sortCode.value.replace(/\D/g, "");

            const accountNumber =
                inputs.accountNumber.value.replace(/\D/g, "");

            if (!accountHolder) {
                showPaymentRequestMessage(
                    message,
                    "Enter the account holder name.",
                    true
                );
                return;
            }

            if (!/^\d{6}$/.test(sortCode)) {
                showPaymentRequestMessage(
                    message,
                    "Enter a valid six-digit sort code.",
                    true
                );
                return;
            }

            if (!/^\d{8}$/.test(accountNumber)) {
                showPaymentRequestMessage(
                    message,
                    "Enter an eight-digit account number.",
                    true
                );
                return;
            }

            button.disabled = true;
            button.textContent = "Saving…";

            Object.values(inputs).forEach((input) => {
                input.disabled = true;
            });

            try {
                const { error } = await client.rpc(
                    "save_payment_request_payment_details",
                    {
                        p_request_id: requestId,
                        p_account_holder_name: accountHolder,
                        p_sort_code: sortCode,
                        p_account_number: accountNumber
                    }
                );

                if (error) throw error;

                Object.values(inputs).forEach((input) => {
                    input.value = "";
                });

                form.replaceChildren(
                    make(
                        "p",
                        "record-description",
                        "Bank details saved successfully. Blackwood Publishing can now review this payment request."
                    )
                );
            } catch (error) {
                console.error(
                    "Saving payment details failed:",
                    error?.code || "Request failed"
                );

                Object.values(inputs).forEach((input) => {
                    input.disabled = false;
                });

                button.disabled = false;
                button.textContent = "Save bank details";

                showPaymentRequestMessage(
                    message,
                    "Bank details could not be saved. Please check your information and try again.",
                    true
                );
            }
        });

        wrapper.appendChild(form);
        return wrapper;
    }

    // ---------------------------------------------------------
    // PUBLISHING STAFF ATTENTION PANEL
    // ---------------------------------------------------------

    async function loadPublishingAttention() {
        const container = elements.publishingAttentionList;
        if (!container) return;

        const [
            requestsResponse,
            authorsResponse,
            detailsResponse
        ] = await Promise.all([
            client
                .from("payment_requests")
                .select(
                    "id,author_id,request_reference,requested_amount,currency,status,requested_at"
                )
                .eq("status", "requested")
                .order("requested_at", { ascending: true }),

            client
                .from("author_records")
                .select("id,publishing_name"),

            client
                .from("payment_request_payment_details")
                .select("payment_request_id")
        ]);

        for (const response of [
            requestsResponse,
            authorsResponse,
            detailsResponse
        ]) {
            if (response.error) throw response.error;
        }

        const requests = requestsResponse.data || [];
        const authors = authorsResponse.data || [];

        const requestsWithDetails = new Set(
            (detailsResponse.data || []).map(
                (row) => row.payment_request_id
            )
        );

        container.replaceChildren();

        if (!requests.length) {
            container.appendChild(
                createEmptyState(
                    "No items currently require attention."
                )
            );
            return;
        }

        requests.forEach((request) => {
            const author = authors.find(
                (row) => row.id === request.author_id
            );

            const card = make("article", "record-card");

            card.append(
                createRecordHeading(
                    request.request_reference ||
                        "Payment Request",
                    "Requested"
                ),
                make(
                    "p",
                    "record-description",
                    author?.publishing_name || "Author"
                ),
                createMetaRow([
                    [
                        "Amount",
                        formatMoney(
                            request.requested_amount,
                            request.currency
                        )
                    ],
                    [
                        "Requested",
                        formatDate(request.requested_at)
                    ]
                ])
            );

            const isDavidTestRequest =
                request.author_id ===
                    "579da283-3a1f-4947-8b53-ba5d54aad939" &&
                request.request_reference ===
                    "TEST-DAVID-REQUEST-001";

            const isProtectedTestRequest =
                request.request_reference ===
                "PR-20260929203327379-d46d923a";

            if (isDavidTestRequest) {
                card.appendChild(
                    createSimulationControl(request)
                );
            }

            const hasDetails = requestsWithDetails.has(
                request.id
            );

            card.appendChild(
                make(
                    "p",
                    "record-description",
                    hasDetails
                        ? "Bank details: Submitted — ready for staff review."
                        : "Bank details: Awaiting author submission."
                )
            );

            if (hasDetails && !isDavidTestRequest) {
                card.appendChild(
                    createStaffBankDetailsReview(request.id)
                );

                if (isProtectedTestRequest) {
                    card.appendChild(
                        make(
                            "p",
                            "record-description",
                            "Test request — payment recording disabled."
                        )
                    );
                } else {
                    card.appendChild(
                        createManualPaymentForm(request)
                    );
                }
            }

            container.appendChild(card);
        });
    }

    function createSimulationControl(request) {
        const panel = make(
            "div",
            "payment-request-control"
        );

        panel.appendChild(
            make(
                "p",
                "record-description",
                "SIMULATION ONLY — No bank transfer will occur. This records a test transaction, not a real payment."
            )
        );

        const button = make(
            "button",
            "payment-request-button",
            "Record Simulated Payment"
        );
        button.type = "button";

        const message = make(
            "p",
            "payment-request-message"
        );
        message.hidden = true;
        message.setAttribute("role", "status");

        button.addEventListener("click", async () => {
            const confirmed = window.confirm(
                "TEST ONLY: Record a simulated £25 payment for David Stewart? NO bank transfer will occur."
            );

            if (!confirmed) return;

            button.disabled = true;
            button.textContent = "Recording simulation…";

            try {
                const { error } = await client.rpc(
                    "record_simulated_author_payment",
                    { p_request_id: request.id }
                );

                if (error) throw error;

                showPaymentRequestMessage(
                    message,
                    "Simulated payment recorded. No money transferred.",
                    false
                );

                window.location.reload();
            } catch (error) {
                console.error(
                    "Simulated payment failed:",
                    error
                );

                showPaymentRequestMessage(
                    message,
                    "Simulation failed. Please check the request and try again.",
                    true
                );

                button.disabled = false;
                button.textContent =
                    "Record Simulated Payment";
            }
        });

        panel.append(button, message);
        return panel;
    }

    function createStaffBankDetailsReview(requestId) {
        const wrapper = make("div");

        const button = make(
            "button",
            "payment-request-button",
            "Review bank details"
        );
        button.type = "button";

        const panel = make(
            "div",
            "payment-request-control"
        );
        panel.hidden = true;

        let reviewOpen = false;

        button.addEventListener("click", async () => {
            if (reviewOpen) {
                panel.replaceChildren();
                panel.hidden = true;
                reviewOpen = false;
                button.textContent = "Review bank details";
                return;
            }

            button.disabled = true;
            button.textContent = "Loading…";

            try {
                const { data, error } = await client
                    .from("payment_request_payment_details")
                    .select(
                        "account_holder_name,sort_code,account_number"
                    )
                    .eq("payment_request_id", requestId)
                    .single();

                if (error) throw error;

                panel.replaceChildren(
                    make(
                        "h4",
                        "record-title",
                        "Bank details for payment"
                    ),
                    createMetaRow([
                        [
                            "Account holder",
                            data.account_holder_name
                        ],
                        ["Sort code", data.sort_code],
                        [
                            "Account number",
                            data.account_number
                        ]
                    ])
                );

                panel.hidden = false;
                reviewOpen = true;
                button.textContent = "Hide bank details";
            } catch (error) {
                console.error(
                    "Staff payment details review failed:",
                    error?.code || "Request failed"
                );

                panel.replaceChildren(
                    make(
                        "p",
                        "payment-request-message error",
                        "Bank details could not be loaded. Please retry."
                    )
                );

                panel.hidden = false;
                button.textContent = "Review bank details";
            } finally {
                button.disabled = false;
            }
        });

        wrapper.append(button, panel);
        return wrapper;
    }

    function createManualPaymentForm(request) {
        const panel = make(
            "div",
            "payment-request-control"
        );

        panel.append(
            make(
                "h4",
                "record-title",
                "Record Completed Payment"
            ),
            make(
                "p",
                "record-description",
                "Only complete this form after the bank transfer has been sent through Blackwood Publishing's bank."
            )
        );

        const form = make(
            "form",
            "payment-request-form"
        );

        const methodField = make(
            "div",
            "payment-request-field"
        );

        const methodId = "payment-method-" + request.id;
        const methodLabel = make(
            "label",
            "",
            "Payment method"
        );
        methodLabel.htmlFor = methodId;

        const methodSelect = document.createElement("select");
        methodSelect.id = methodId;
        methodSelect.required = true;

        [
            ["", "Select payment method"],
            ["FASTER PAYMENTS", "Faster Payments"],
            ["BACS", "BACS"],
            ["OTHER BANK TRANSFER", "Other bank transfer"]
        ].forEach(([value, text]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = text;
            methodSelect.appendChild(option);
        });

        methodField.append(methodLabel, methodSelect);

        const referenceField = make(
            "div",
            "payment-request-field"
        );

        const referenceId = "bank-reference-" + request.id;
        const referenceLabel = make(
            "label",
            "",
            "Bank transaction reference"
        );
        referenceLabel.htmlFor = referenceId;

        const referenceInput = document.createElement("input");

        Object.assign(referenceInput, {
            id: referenceId,
            type: "text",
            required: true,
            maxLength: 100,
            autocomplete: "off"
        });

        referenceField.append(
            referenceLabel,
            referenceInput
        );

        const confirmationLabel = make(
            "label",
            "payment-confirmation-label"
        );

        const confirmationCheckbox =
            document.createElement("input");

        confirmationCheckbox.type = "checkbox";
        confirmationCheckbox.required = true;

        confirmationLabel.append(
            confirmationCheckbox,
            make(
                "span",
                "",
                "I confirm that this payment has already been sent through Blackwood Publishing's bank."
            )
        );

        const button = make(
            "button",
            "payment-request-button",
            "Record completed payment"
        );
        button.type = "submit";

        const message = make(
            "p",
            "payment-request-message"
        );
        message.hidden = true;
        message.setAttribute("role", "status");

        form.append(
            methodField,
            referenceField,
            confirmationLabel,
            button,
            message
        );

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (
                !confirmationCheckbox.checked ||
                !methodSelect.value ||
                !referenceInput.value.trim()
            ) {
                return;
            }

            const confirmed = window.confirm(
                "Confirm that " +
                    formatMoney(
                        request.requested_amount,
                        request.currency
                    ) +
                    " has ALREADY been transferred through your bank to this author. Recording this payment will update the financial records. Continue?"
            );

            if (!confirmed) return;

            methodSelect.disabled = true;
            referenceInput.disabled = true;
            confirmationCheckbox.disabled = true;

            try {
                await recordCompletedPayment(
                    request.id,
                    methodSelect.value,
                    referenceInput.value.trim(),
                    button,
                    message
                );
            } finally {
                methodSelect.disabled = false;
                referenceInput.disabled = false;
                confirmationCheckbox.disabled = false;
            }
        });

        panel.appendChild(form);
        return panel;
    }

    async function recordCompletedPayment(
        requestId,
        paymentMethod,
        bankReference,
        button,
        message
    ) {
        clearPaymentRequestMessage(message);

        button.disabled = true;
        button.textContent = "Recording payment…";

        try {
            const { error } = await client.rpc(
                "record_manual_author_payment",
                {
                    p_request_id: requestId,
                    p_payment_method: paymentMethod,
                    p_bank_reference: bankReference || null
                }
            );

            if (error) throw error;

            showPaymentRequestMessage(
                message,
                "Completed bank transfer recorded successfully.",
                false
            );

            window.location.reload();
        } catch (error) {
            console.error(
                "Recording completed payment failed:",
                error
            );

            showPaymentRequestMessage(
                message,
                "Payment could not be recorded. Please check the request and try again.",
                true
            );
        } finally {
            button.disabled = false;
            button.textContent = "Record completed payment";
        }
    }

    // ---------------------------------------------------------
    // SHARED DOM HELPERS
    // ---------------------------------------------------------

    function make(tag, className = "", text = null) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== null && text !== undefined) {
            element.textContent = String(text);
        }

        return element;
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value ?? "");
        }
    }

    function createRecordHeading(
        title,
        status,
        headingTag = "h4"
    ) {
        const top = make("div", "record-card-top");

        top.append(
            make(headingTag, "record-title", title),
            createStatusBadge(status)
        );

        return top;
    }

    function createMetaRow(items) {
        const meta = make("div", "record-meta");

        items.forEach(([label, value]) => {
            appendMeta(meta, label, value);
        });

        return meta;
    }

    function appendMeta(container, label, value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return;
        }

        container.appendChild(
            createInlineMeta(label, value)
        );
    }

    function createSummaryRecord(
        label,
        value,
        className
    ) {
        const card = make("article", className);

        card.append(
            make("p", "summary-label", label),
            make(
                "p",
                "summary-value",
                value || "Not recorded"
            )
        );

        return card;
    }

    function createContentPanel(title, intro) {
        const panel = make("section", "content-panel");

        panel.appendChild(make("h3", "", title));

        if (intro) {
            panel.appendChild(
                make("p", "panel-intro", intro)
            );
        }

        return panel;
    }

    function createEmptyState(message) {
        return make("div", "empty-state", message);
    }

    function createStatusBadge(value) {
        return make(
            "span",
            "status-badge",
            value || "Not recorded"
        );
    }

    function createMetaItem(label, value) {
        const wrapper = make("div");

        wrapper.append(
            make("span", "meta-label", label),
            make(
                "span",
                "meta-value",
                value || "Not recorded"
            )
        );

        return wrapper;
    }

    function createInlineMeta(label, value) {
        const wrapper = make("span");
        const strong = make(
            "strong",
            "",
            label + ": "
        );

        wrapper.append(
            strong,
            document.createTextNode(
                value === null ||
                value === undefined ||
                value === ""
                    ? "Not recorded"
                    : String(value)
            )
        );

        return wrapper;
    }

    function createFinanceSummaryCard(
        label,
        value,
        description
    ) {
        const card = make(
            "article",
            "finance-summary-card"
        );

        card.append(
            make("p", "summary-label", label),
            make("p", "summary-value", value),
            make(
                "p",
                "finance-summary-description",
                description
            )
        );

        return card;
    }

    function showPaymentRequestMessage(
        element,
        message,
        isError
    ) {
        element.textContent = message;
        element.hidden = false;
        element.classList.toggle("error", isError);
        element.classList.toggle("success", !isError);
    }

    function clearPaymentRequestMessage(element) {
        element.textContent = "";
        element.hidden = true;
        element.classList.remove("error", "success");
    }

    // ---------------------------------------------------------
    // NAVIGATION, AUTH AND FORMATTING
    // ---------------------------------------------------------

    function showSection(sectionName) {
        navButtons.forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.section === sectionName
            );
        });

        deskSections.forEach((section) => {
            section.classList.toggle(
                "active",
                section.id === "section-" + sectionName
            );
        });
    }

    async function handleSignOut() {
        const button = elements.signOutButton;
        if (!button) return;

        button.disabled = true;
        button.textContent = "Signing out…";

        try {
            const { error } = await client.auth.signOut();

            if (error) throw error;

            currentAuthor = null;
            currentBooks = [];
            currentMonthlyRoyalties = [];
            monthlyRoyaltiesAvailable = false;

            elements.desk.hidden = true;

            showAccessMessage(
                "Signed out",
                "You have been signed out of the Author Desk."
            );
        } catch (error) {
            console.error(
                "Author Desk sign-out failed:",
                error
            );

            button.disabled = false;
            button.textContent = "Sign out";
        }
    }

    function showAccessMessage(title, message) {
        if (elements.loadingPanel) {
            elements.loadingPanel.hidden = true;
        }

        if (elements.desk) {
            elements.desk.hidden = true;
        }

        setText(elements.accessTitle, title);
        setText(elements.accessMessage, message);

        if (elements.accessPanel) {
            elements.accessPanel.hidden = false;
        }
    }

    function formatLabel(value) {
        if (!value) return "Not recorded";

        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (character) =>
                character.toUpperCase()
            );
    }

    function formatDate(value) {
        if (!value) return "Not recorded";

        const raw = String(value);

        const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? new Date(raw + "T12:00:00")
            : new Date(raw);

        if (Number.isNaN(date.getTime())) {
            return raw;
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function formatMonth(value) {
        if (!value) return "Unknown month";

        const raw = String(value);
        const match = raw.match(/^(\d{4})-(\d{2})/);

        if (!match) return raw;

        const date = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            1
        );

        if (Number.isNaN(date.getTime())) {
            return raw;
        }

        return new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function formatMoney(value, currency) {
        const amount = Number(value);

        if (!Number.isFinite(amount) || !currency) {
            return String(value ?? "Not recorded");
        }

        try {
            return new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency
            }).format(amount);
        } catch (error) {
            return currency + " " + amount.toFixed(2);
        }
    }

    function normaliseCurrency(currency) {
        return currency
            ? String(currency).trim().toUpperCase()
            : "";
    }

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function sumValues(records, property) {
        return records.reduce(
            (sum, record) =>
                sum + toNumber(record[property]),
            0
        );
    }
})();
