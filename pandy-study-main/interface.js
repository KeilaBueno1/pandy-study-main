
document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;

    // =====================================
    // PREFERÊNCIAS SALVAS
    // =====================================

    const temasPermitidos = ["light", "dark"];
    const paletasPermitidas = ["blue", "purple", "green", "pink"];

    let temaSalvo = localStorage.getItem("pandy-theme") || "light";
    let paletaSalva = localStorage.getItem("pandy-palette") || "blue";

    if (!temasPermitidos.includes(temaSalvo)) {
        temaSalvo = "light";
    }

    if (!paletasPermitidas.includes(paletaSalva)) {
        paletaSalva = "blue";
    }

    root.dataset.theme = temaSalvo;
    root.dataset.palette = paletaSalva;

    // =====================================
    // TEMA CLARO E ESCURO
    // =====================================

    const botaoTema = document.getElementById("theme-toggle");

    function atualizarBotaoTema() {
        if (!botaoTema) return;

        const escuro = root.dataset.theme === "dark";

        botaoTema.textContent = escuro ? "☀" : "☾";
        botaoTema.title = escuro
            ? "Ativar tema claro"
            : "Ativar tema escuro";

        botaoTema.setAttribute("aria-label", botaoTema.title);
    }

    atualizarBotaoTema();

    botaoTema?.addEventListener("click", () => {
        root.dataset.theme =
            root.dataset.theme === "dark" ? "light" : "dark";

        localStorage.setItem("pandy-theme", root.dataset.theme);
        atualizarBotaoTema();
    });

    // =====================================
    // PALETAS DE CORES
    // =====================================

    const seletorPaleta = document.getElementById("palette-select");

    if (seletorPaleta) {
        seletorPaleta.value = paletaSalva;

        seletorPaleta.addEventListener("change", () => {
            const novaPaleta = seletorPaleta.value;

            if (!paletasPermitidas.includes(novaPaleta)) return;

            root.dataset.palette = novaPaleta;
            localStorage.setItem("pandy-palette", novaPaleta);
        });
    }

    // =====================================
    // MENU LATERAL
    // =====================================

    const botaoMenu = document.getElementById("sidebar-toggle");

    const menuRecolhido =
        localStorage.getItem("pandy-sidebar") === "collapsed";

    if (window.innerWidth > 850 && menuRecolhido) {
        document.body.classList.add("sidebar-collapsed");
    }

    botaoMenu?.addEventListener("click", () => {
        if (window.innerWidth <= 600) {
            document.body.classList.toggle("menu-mobile-open");
            return;
        }

        document.body.classList.toggle("sidebar-collapsed");

        const recolhido =
            document.body.classList.contains("sidebar-collapsed");

        localStorage.setItem(
            "pandy-sidebar",
            recolhido ? "collapsed" : "expanded"
        );
    });

    // Fechar menu ao clicar em um link no celular
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document.body.classList.remove("menu-mobile-open");
        });
    });

    // Fechar menu ao clicar fora dele
    document.addEventListener("click", evento => {
        if (
            window.innerWidth <= 600 &&
            document.body.classList.contains("menu-mobile-open") &&
            !evento.target.closest(".sidebar") &&
            !evento.target.closest("#sidebar-toggle")
        ) {
            document.body.classList.remove("menu-mobile-open");
        }
    });

    // =====================================
    // NAVEGAÇÃO ATIVA
    // =====================================

    const links = document.querySelectorAll(".nav-link");

    function atualizarLinkAtivo() {
        const destino = window.location.hash || "#inicio";

        links.forEach(link => {
            link.classList.toggle(
                "active",
                link.getAttribute("href") === destino
            );
        });
    }

    links.forEach(link => {
        link.addEventListener("click", () => {
            links.forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });

    window.addEventListener("hashchange", atualizarLinkAtivo);
    atualizarLinkAtivo();

    // =====================================
    // AJUSTE AUTOMÁTICO AO REDIMENSIONAR
    // =====================================

    window.addEventListener("resize", () => {
        if (window.innerWidth > 600) {
            document.body.classList.remove("menu-mobile-open");
        }
    });

    console.log("Personalização do Pandy Study carregada!");
});
