(() => {
    "use strict";

    const BIRTH_DATE = new Date(2005, 5, 10); // 10.06.2005
    const HOME = { lat: 53.9006, lon: 27.559 }; // Minsk
    const COORDS = "53.9006° N / 27.5590° E";
    const GITHUB_USER = "KROU4";
    const CONTRIB_API = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`;

    const I18N = {
        ru: {
            title: "Дмитрий Велютич — Senior AI Engineer",
            langNav: "Язык",
            coordsHint: "Нажми",
            label1: "(01) — Визитка",
            firstName: "Дмитрий",
            lastName: "Велютич",
            lead: "Живу и работаю в Минске.",
            photoAlt: "Портрет Дмитрия Велютича",
            caption: "Д. Велютич",
            city: "Город",
            cityValue: "Минск",
            field: "Направление",
            level: "Уровень",
            age: "Возраст",
            label2: "(02) — Связь",
            channels: "07 каналов",
            label3: "(03) — Активность на GitHub",
            less: "Меньше",
            more: "Больше",
            calError: "Календарь не загрузился.",
            calErrorLink: "Смотреть на GitHub ↗",
            calLabel: "Календарь активности на GitHub",
            contribForms: { one: "контрибуция", few: "контрибуции", many: "контрибуций", other: "контрибуций" },
            perYear: "за год",
            minskTime: (time) => `В Минске сейчас ${time}`,
            searching: "Ищу тебя...",
            neighbours: "Мы почти соседи",
            distance: (km) => `До меня ≈ ${km} км`,
            hidden: "Локация скрыта. Уважаю",
            noGeo: "Ты где-то рядом",
        },
        en: {
            title: "Dmitry Velyutich — Senior AI Engineer",
            langNav: "Language",
            coordsHint: "Click me",
            label1: "(01) — Profile",
            firstName: "Dmitry",
            lastName: "Velyutich",
            lead: "Based in Minsk.",
            photoAlt: "Portrait of Dmitry Velyutich",
            caption: "D. Velyutich",
            city: "City",
            cityValue: "Minsk",
            field: "Field",
            level: "Level",
            age: "Age",
            label2: "(02) — Contact",
            channels: "07 channels",
            label3: "(03) — GitHub activity",
            less: "Less",
            more: "More",
            calError: "The calendar didn't load.",
            calErrorLink: "See it on GitHub ↗",
            calLabel: "GitHub contribution calendar",
            contribForms: { one: "contribution", other: "contributions" },
            perYear: "in the last year",
            minskTime: (time) => `Minsk time ${time}`,
            searching: "Locating you...",
            neighbours: "Practically neighbours",
            distance: (km) => `≈ ${km} km from me`,
            hidden: "Location hidden. Respect",
            noGeo: "You're somewhere close",
        },
    };

    const $ = (selector) => document.querySelector(selector);
    const root = document.documentElement;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const storage = (area) => ({
        get(key) { try { return area().getItem(key); } catch { return null; } },
        set(key, value) { try { area().setItem(key, value); } catch { /* unavailable */ } },
    });
    const local = storage(() => localStorage);
    const session = storage(() => sessionStorage);

    let lang = local.get("lang") || (/^(ru|be|uk)/i.test(navigator.language) ? "ru" : "en");
    const t = (key) => I18N[lang][key];
    const plural = (n, forms) => forms[new Intl.PluralRules(lang).select(n)] || forms.other;

    // ---------- Age ----------

    function getAge(now = new Date()) {
        const beforeBirthday = now.getMonth() < BIRTH_DATE.getMonth()
            || (now.getMonth() === BIRTH_DATE.getMonth() && now.getDate() < BIRTH_DATE.getDate());
        return now.getFullYear() - BIRTH_DATE.getFullYear() - (beforeBirthday ? 1 : 0);
    }

    // ---------- Easter egg: coordinates ----------
    // Click cycles: coordinates → local time in Minsk → distance from the visitor → coordinates.

    const coordsText = $("#coords-text");
    let coordsStep = 0;
    let scrambleTimer;

    function scrambleTo(target) {
        clearInterval(scrambleTimer);
        if (reduceMotion) {
            coordsText.textContent = target;
            return;
        }
        const glyphs = "0123456789°/.,—NE";
        const frames = 14;
        let frame = 0;
        scrambleTimer = setInterval(() => {
            frame++;
            const done = Math.floor((target.length * frame) / frames);
            let out = "";
            for (let i = 0; i < target.length; i++) {
                out += i < done || target[i] === " " ? target[i] : glyphs[Math.floor(Math.random() * glyphs.length)];
            }
            coordsText.textContent = out;
            if (frame >= frames) clearInterval(scrambleTimer);
        }, 35);
    }

    function distanceKm(lat, lon) {
        const rad = (deg) => (deg * Math.PI) / 180;
        const a = Math.sin(rad(lat - HOME.lat) / 2) ** 2
            + Math.cos(rad(HOME.lat)) * Math.cos(rad(lat)) * Math.sin(rad(lon - HOME.lon) / 2) ** 2;
        return Math.round(12742 * Math.asin(Math.sqrt(a)));
    }

    $("#coords").addEventListener("click", () => {
        coordsStep = (coordsStep + 1) % 3;

        if (coordsStep === 0) return scrambleTo(COORDS);

        if (coordsStep === 1) {
            const time = new Intl.DateTimeFormat(lang, { timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
            return scrambleTo(t("minskTime")(time).toUpperCase());
        }

        if (!navigator.geolocation) return scrambleTo(t("noGeo").toUpperCase());
        scrambleTo(t("searching").toUpperCase());
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (coordsStep !== 2) return;
                const km = distanceKm(pos.coords.latitude, pos.coords.longitude);
                scrambleTo((km < 30 ? t("neighbours") : t("distance")(km.toLocaleString(lang))).toUpperCase());
            },
            () => {
                if (coordsStep === 2) scrambleTo(t("hidden").toUpperCase());
            },
            { timeout: 10000, maximumAge: 600000 },
        );
    });

    // ---------- GitHub contribution calendar ----------

    let contrib = null; // null = loading, "error" = failed, object = loaded
    const grid = $("#cal-grid");

    async function loadContributions() {
        const cacheKey = `contrib:${GITHUB_USER}`;
        try {
            const cached = JSON.parse(session.get(cacheKey));
            if (cached && Date.now() - cached.time < 36e5) return cached.data;
        } catch { /* broken cache */ }

        const res = await fetch(CONTRIB_API);
        if (!res.ok) throw new Error(`Contributions API: ${res.status}`);
        const json = await res.json();
        const data = { total: json.total.lastYear, days: json.contributions.map((d) => [d.date, d.count]) };
        session.set(cacheKey, JSON.stringify({ time: Date.now(), data }));
        return data;
    }

    // Own levels by quartiles of non-zero days: gives a more even spread than the API's levels
    function levelFor(count, thresholds) {
        if (!count) return 0;
        return 1 + thresholds.filter((limit) => count > limit).length;
    }

    function quartiles(days) {
        const counts = days.map(([, c]) => c).filter(Boolean).sort((a, b) => a - b);
        if (!counts.length) return [Infinity, Infinity, Infinity];
        const at = (q) => counts[Math.floor((counts.length - 1) * q)];
        return [at(0.25), at(0.5), at(0.75)];
    }

    function parseDate(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    function renderCalendar() {
        grid.setAttribute("aria-label", t("calLabel"));

        if (contrib === "error") {
            $("#cal").hidden = true;
            $(".cal__foot").hidden = true;
            $("#cal-error").hidden = false;
            return;
        }

        // Placeholder cells while loading
        if (!grid.childElementCount) {
            grid.append(...Array.from({ length: 53 * 7 }, () => document.createElement("i")));
        }
        if (!contrib) return;

        const { days, total } = contrib;
        // Last 53 weeks, each column starting on a Sunday like on GitHub
        let start = Math.max(0, days.length - 53 * 7);
        while (start < days.length && parseDate(days[start][0]).getDay() !== 0) start++;
        const cells = days.slice(start);
        const thresholds = quartiles(cells);
        const dateFmt = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long" });
        const monthFmt = new Intl.DateTimeFormat(lang, { month: "short" });

        [...grid.children].forEach((cell, i) => {
            const day = cells[i];
            if (!day) {
                cell.className = "empty";
                cell.removeAttribute("title");
                return;
            }
            const [iso, count] = day;
            cell.className = `l${levelFor(count, thresholds)}`;
            cell.style.transitionDelay = reduceMotion ? "" : `${Math.floor(i / 7) * 12}ms`;
            cell.title = `${count} ${plural(count, t("contribForms"))} · ${dateFmt.format(parseDate(iso))}`;
        });

        // Month labels over the column where each month starts
        const months = $("#cal-months");
        months.replaceChildren();
        for (let col = 0; col < 53; col++) {
            const week = cells.slice(col * 7, col * 7 + 7);
            const first = week.find(([iso]) => iso.endsWith("-01"));
            if (!first || col > 50) continue;
            const label = document.createElement("span");
            label.style.gridColumn = `${col + 1} / span 4`;
            label.textContent = monthFmt.format(parseDate(first[0])).replace(".", "");
            months.append(label);
        }

        $("#cal-total").textContent = `${total.toLocaleString(lang)} ${plural(total, t("contribForms"))} ${t("perYear")}`;
    }

    async function initCalendar() {
        renderCalendar();
        try {
            contrib = await loadContributions();
        } catch (err) {
            console.warn(err);
            contrib = "error";
        }
        renderCalendar();
        const cal = $("#cal");
        cal.scrollLeft = cal.scrollWidth; // on phones, start at the most recent weeks
    }

    // ---------- Language ----------

    function applyLanguage() {
        root.lang = lang;
        document.title = t("title");
        document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
        document.querySelectorAll("[data-i18n-alt]").forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
        document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
        document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
        document.querySelectorAll("[data-lang]").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang)));

        // Texts inside the coordinates easter egg are language-specific: start the cycle over
        coordsStep = 0;
        clearInterval(scrambleTimer);
        coordsText.textContent = COORDS;

        renderCalendar();
    }

    document.querySelectorAll("[data-lang]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (btn.dataset.lang === lang) return;
            lang = btn.dataset.lang;
            local.set("lang", lang);
            applyLanguage();
        });
    });

    // ---------- Init ----------

    $("#age").textContent = getAge();
    applyLanguage();
    initCalendar();
})();
