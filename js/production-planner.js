/* Manual, account-scoped browser workspace. Author Desk sharing requires RLS-backed storage. */
"use strict";
(function () {
    const defaults = ["Manuscript", "Editing", "Author review", "Proofreading", "Cover & layout", "Final approval", "Publication"];
    const statuses = ["Planned", "In progress", "Blocked", "Complete"];
    const day = 86400000;
    const $ = id => document.getElementById(id);
    const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
    let key = null, projects = [], editing = null, initialized = false;
    const message = text => { $("planner-status").textContent = text; };
    function date(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
        const ms = Date.parse(value + "T00:00:00Z");
        return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
    }
    function validate(data) {
        if (data?.version !== 1 || !Array.isArray(data.projects) || data.projects.length > 1000) throw Error("Choose a valid version 1 planner backup (up to 1,000 projects).");
        const ids = new Set();
        for (const p of data.projects) {
            for (const field of ["id", "author", "book", "title"]) {
                if (typeof p[field] !== "string" || !p[field].trim() || p[field].length > 200) throw Error("Every project needs an ID, author, book and project name.");
            }
            if (ids.has(p.id)) throw Error("Duplicate project IDs in backup.");
            ids.add(p.id);
            for (const field of ["authorId", "bookId"]) if (p[field] != null && (typeof p[field] !== "string" || p[field].length > 100)) throw Error("Invalid record ID.");
            if (!Array.isArray(p.stages) || !p.stages.length || p.stages.length > 100) throw Error("Each project needs 1–100 stages.");
            for (const s of p.stages) {
                if (typeof s.name !== "string" || !s.name.trim() || s.name.length > 160 || !statuses.includes(s.status)) throw Error("Each stage needs a name and valid status.");
                if (!Number.isFinite(date(s.start)) || !Number.isFinite(date(s.end)) || s.end < s.start) throw Error("Each stage needs valid dates, with finish on or after start.");
            }
        }
        return data.projects;
    }
    function persist(next) {
        if (!key) throw Error("Administrator verification is required.");
        validate({version: 1, projects: next});
        localStorage.setItem(key, JSON.stringify({version: 1, projects: next}));
        projects = next;
        render();
    }
    function stageRow(stage = {name: "", start: "", end: "", status: "Planned"}) {
        const row = document.createElement("tr");
        row.innerHTML = `<td><input aria-label="Stage name" data-field="name" required maxlength="160" value="${escape(stage.name)}"></td>
            <td><input aria-label="Start date" data-field="start" type="date" required value="${escape(stage.start)}"></td>
            <td><input aria-label="Finish date" data-field="end" type="date" required value="${escape(stage.end)}"></td>
            <td><select aria-label="Stage status" data-field="status">${statuses.map(s => `<option${s === stage.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
            <td><button type="button" class="bfa-button" aria-label="Remove stage">Remove</button></td>`;
        row.querySelector("button").onclick = () => row.remove();
        $("planner-stages").append(row);
    }
    function edit(project) {
        editing = project?.id || null;
        const form = $("planner-form");
        form.reset();
        for (const field of ["author", "book", "title", "authorId", "bookId"]) form.elements[field].value = project?.[field] || "";
        $("planner-form-title").textContent = project ? "Edit project" : "New project";
        $("planner-stages").replaceChildren();
        (project?.stages || defaults.map(name => ({name, start: "", end: "", status: "Planned"}))).forEach(stageRow);
        form.hidden = false;
        form.elements.author.focus();
    }
    function render() {
        const query = $("planner-filter").value.trim().toLowerCase();
        const visible = projects.filter(p => `${p.author} ${p.book} ${p.title}`.toLowerCase().includes(query));
        const host = $("planner-projects");
        host.replaceChildren();
        if (!visible.length) { host.textContent = projects.length ? "No matching projects." : "No projects yet. Create your first book project above."; return; }
        for (const p of visible) {
            const currentIndex = p.stages.findIndex(s => s.status !== "Complete");
            const current = p.stages[currentIndex];
            const next = p.stages.slice(currentIndex + 1).find(s => s.status !== "Complete");
            const done = p.stages.filter(s => s.status === "Complete").length;
            const today = new Date().toLocaleDateString("en-CA");
            const overdue = p.stages.some(s => s.status !== "Complete" && s.end < today);
            const min = Math.min(...p.stages.map(s => date(s.start)));
            const max = Math.max(...p.stages.map(s => date(s.end)));
            const span = (max - min) / day + 1;
            const card = document.createElement("article");
            card.className = "planner-project";
            card.innerHTML = `<h3>${escape(p.book)} · ${escape(p.title)}</h3><p>${escape(p.author)} · ${done}/${p.stages.length} stages complete${overdue ? " · Overdue" : ""}</p>
                <p><strong>Current:</strong> ${current ? escape(current.name) + " (" + escape(current.status) + ")" : "Project complete"} · <strong>Next:</strong> ${current && next ? escape(next.name) : "None"}</p>
                <p class="planner-legend">Planned · In progress · Blocked · Complete — each bar also shows its status.</p>
                <div class="planner-scroll" tabindex="0" role="region" aria-label="${escape(p.book)} Gantt timeline">
                <div class="planner-gantt"><div class="planner-axis"><span>Stage</span><span>${new Date(min).toLocaleDateString("en-GB", {timeZone:"UTC"})} — ${new Date(max).toLocaleDateString("en-GB", {timeZone:"UTC"})}</span></div>
                ${p.stages.map(s => `<div class="planner-gantt-row"><strong>${escape(s.name)}</strong><div class="planner-track"><div class="planner-bar planner-${s.status.toLowerCase().replace(/ /g, "-")}" style="margin-left:${(date(s.start)-min)/day/span*100}%;width:${((date(s.end)-date(s.start))/day+1)/span*100}%"></div><span>${escape(s.start)} → ${escape(s.end)} · ${escape(s.status)}</span></div></div>`).join("")}</div></div>
                <div class="planner-toolbar"><button type="button" class="bfa-button" data-action="edit">Edit project</button><button type="button" class="bfa-button" data-action="delete">Delete project</button></div>`;
            card.querySelector('[data-action="edit"]').onclick = () => edit(p);
            card.querySelector('[data-action="delete"]').onclick = () => {
                if (!key || !confirm(`Delete ${p.title} for ${p.book}? Export a backup first if you need to keep it.`)) return;
                try { persist(projects.filter(item => item.id !== p.id)); if (editing === p.id) $("planner-form").hidden = true; message("Project deleted from this browser."); } catch (e) { message(e.message); }
            };
            host.append(card);
        }
    }
    function initialize() {
        $("planner-new").onclick = () => { if (key) edit(); };
        $("planner-cancel").onclick = () => { $("planner-form").hidden = true; };
        $("planner-add-stage").onclick = () => { if ($("planner-stages").children.length < 100) stageRow(); };
        $("planner-filter").oninput = render;
        $("planner-form").onsubmit = event => {
            event.preventDefault();
            if (!key) return;
            const form = event.currentTarget;
            const p = {id: editing || crypto.randomUUID(), stages: []};
            for (const field of ["author", "book", "title", "authorId", "bookId"]) p[field] = form.elements[field].value.trim();
            for (const row of $("planner-stages").children) {
                const s = {};
                row.querySelectorAll("[data-field]").forEach(input => { s[input.dataset.field] = input.value.trim(); });
                p.stages.push(s);
            }
            try {
                persist(editing ? projects.map(item => item.id === editing ? p : item) : [...projects, p]);
                form.hidden = true;
                message("Project saved in this browser. Export a backup to keep a separate copy.");
            } catch (e) { message("Could not save: " + e.message); }
        };
        $("planner-export").onclick = () => {
            if (!key) return;
            const url = URL.createObjectURL(new Blob([JSON.stringify({version: 1, projects}, null, 2)], {type: "application/json"}));
            const a = document.createElement("a"); a.href = url; a.download = "blackwood-projects.json"; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            message("Backup exported. Keep it somewhere safe.");
        };
        $("planner-import").onchange = async event => {
            const accountKey = key;
            const file = event.target.files[0];
            if (!accountKey || !file) return;
            try {
                if (file.size > 5000000) throw Error("Backup must be under 5 MB.");
                const incoming = validate(JSON.parse(await file.text()));
                if (key !== accountKey) return;
                if (!confirm(`Replace all ${projects.length} local projects with ${incoming.length} projects from this backup?`)) return;
                persist(incoming);
                $("planner-form").hidden = true;
                message("Backup restored in this browser.");
            } catch (e) { message("Could not restore: " + e.message); }
            finally { event.target.value = ""; }
        };
    }
    window.BlackwoodPlanner = {
        activate(userId) {
            if (!initialized) { initialize(); initialized = true; }
            key = "blackwood-production-v1:" + userId;
            try { const raw = localStorage.getItem(key); projects = raw ? validate(JSON.parse(raw)) : []; message(""); render(); }
            catch (e) { projects = []; key = null; $("planner-projects").replaceChildren(); message("Local plans could not be loaded. Existing data has been preserved; check browser storage before continuing. " + e.message); }
        },
        lock() {
            key = null; projects = []; editing = null;
            $("planner-projects")?.replaceChildren();
            if ($("planner-form")) { $("planner-form").reset(); $("planner-form").hidden = true; }
            $("planner-stages")?.replaceChildren();
        }
    };
})();
