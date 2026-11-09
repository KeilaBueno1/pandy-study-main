document.addEventListener("DOMContentLoaded", async function () {
    const API = "";

    // =====================================
    // MATÉRIAS
    // =====================================

    const formMateria = document.getElementById("form-materia");
    const campoNome = document.getElementById("nome-materia");
    const campoProfessor = document.getElementById("professor-materia");
    const campoHorario = document.getElementById("horario-materia");
    const listaMaterias = document.getElementById("lista-materias");
    const totalMaterias = document.getElementById("total-materias");

    // =====================================
    // ANOTAÇÕES
    // =====================================

    const formAnotacao = document.getElementById("form-anotacao");
    const selectMateria = document.getElementById("materia-anotacao");
    const campoTitulo = document.getElementById("titulo-anotacao");
    const campoData = document.getElementById("data-anotacao");
    const campoTexto = document.getElementById("texto-anotacao");
    const listaAnotacoes = document.getElementById("lista-anotacoes");
    const totalAnotacoes = document.getElementById("total-anotacoes");
    const btnSalvarAnotacao = document.getElementById("btn-salvar-anotacao");
    const btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");

    let materias = [];
    let anotacoes = [];
    let tarefas = [];
    let horarios = [];
    let anotacaoEmEdicao = null;
    let tarefaEmEdicao = null;
    let horarioEmEdicao = null;
    let filtroAtual = "todas";

    // =====================================
    // COMUNICAÇÃO COM O SERVIDOR
    // =====================================

    async function requisicaoAPI(url, opcoes = {}) {
        const resposta = await fetch(API + url, {
            ...opcoes,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(opcoes.headers || {})
            }
        });

        let dados = {};

        try {
            dados = await resposta.json();
        } catch (erro) {
            dados = {};
        }

        if (resposta.status === 401) {
            alert("Sua sessão expirou. Entre novamente na sua conta.");
            window.location.replace("login.html");
            throw new Error("Usuário não autenticado.");
        }

        if (!resposta.ok) {
            throw new Error(dados.mensagem || "Erro na comunicação com o servidor.");
        }

        return dados;
    }

    async function carregarLista(url, chave) {
        try {
            const dados = await requisicaoAPI(url);

            return Array.isArray(dados[chave]) ? dados[chave] : [];

        } catch (erro) {
            console.error("Erro ao carregar " + chave + ":", erro);
            return null;
        }
    }

    // =====================================
    // RESUMO DA PÁGINA INICIAL
    // =====================================

    function atualizarResumo() {
        const cartoes = document.querySelectorAll(".summary-card");

        if (cartoes[0]) {
            cartoes[0].querySelector("strong").textContent = materias.length;
        }
    }

    // =====================================
    // SELETORES DE MATÉRIAS
    // =====================================

    function preencherSelectTarefas() {
        const select = document.getElementById("materia-tarefa");
        if (!select) return;

        const valorAnterior = select.value;
        select.replaceChildren();

        const inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent = "Selecione uma matéria";
        select.appendChild(inicial);

        materias.forEach(function (materia) {
            const opcao = document.createElement("option");
            opcao.value = materia.id;
            opcao.textContent = materia.nome;
            select.appendChild(opcao);
        });

        if (materias.some(m => m.id === valorAnterior)) {
            select.value = valorAnterior;
        }
    }

    function preencherSelectHorarios() {
        const select = document.getElementById("materia-horario");
        if (!select) return;

        const valorAtual = select.value;
        select.replaceChildren();

        const inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent = "Escolha uma matéria";
        select.appendChild(inicial);

        materias.forEach(function (materia) {
            const opcao = document.createElement("option");
            opcao.value = materia.id;
            opcao.textContent = materia.nome;
            select.appendChild(opcao);
        });

        if (materias.some(m => m.id === valorAtual)) {
            select.value = valorAtual;
        }
    }

    function atualizarSeletoresMaterias() {
        if (selectMateria) {
            const valorAnterior = selectMateria.value;
            selectMateria.replaceChildren();

            const inicial = document.createElement("option");
            inicial.value = "";
            inicial.textContent = "Selecione uma matéria";
            selectMateria.appendChild(inicial);

            materias.forEach(function (materia) {
                const opcao = document.createElement("option");
                opcao.value = materia.id;
                opcao.textContent = materia.nome;
                selectMateria.appendChild(opcao);
            });

            if (materias.some(m => m.id === valorAnterior)) {
                selectMateria.value = valorAnterior;
            }
        }

        preencherSelectTarefas();
        preencherSelectHorarios();
    }

    // =====================================
    // CADASTRO E LISTA DE MATÉRIAS
    // =====================================

    function renderizarMaterias() {
        listaMaterias.replaceChildren();

        totalMaterias.textContent =
            materias.length +
            (materias.length === 1 ? " matéria" : " matérias");

        materias.forEach(function (materia) {
            const card = document.createElement("article");
            card.className = "materia-card";

            const titulo = document.createElement("h4");
            titulo.textContent = materia.nome;
            card.appendChild(titulo);

            if (materia.professor) {
                const professor = document.createElement("p");
                professor.textContent = "Professor: " + materia.professor;
                card.appendChild(professor);
            }

            if (materia.horario) {
                const horario = document.createElement("p");
                horario.textContent = "Horário: " + materia.horario;
                card.appendChild(horario);
            }

            const rodape = document.createElement("div");
            rodape.className = "materia-card-footer";

            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "btn-delete";
            excluir.textContent = "Excluir";

            excluir.addEventListener("click", async function () {
                if (!confirm('Deseja excluir a matéria "' + materia.nome + '"? As tarefas, anotações e horários dela também serão excluídos.')) {
                    return;
                }

                excluir.disabled = true;

                try {
                    await requisicaoAPI(
                        "/api/materias/" + encodeURIComponent(materia.id),
                        { method: "DELETE" }
                    );

                    // O BANCO JÁ APAGA OS ITENS DA MATÉRIA (ON DELETE CASCADE)
                    materias = materias.filter(m => m.id !== materia.id);
                    anotacoes = anotacoes.filter(a => a.materiaId !== materia.id);
                    tarefas = tarefas.filter(t => t.materiaId !== materia.id);
                    horarios = horarios.filter(h => h.materiaId !== materia.id);

                    if (
                        anotacaoEmEdicao &&
                        !anotacoes.some(a => a.id === anotacaoEmEdicao)
                    ) {
                        cancelarEdicao();
                    }

                    if (
                        tarefaEmEdicao &&
                        !tarefas.some(t => t.id === tarefaEmEdicao)
                    ) {
                        cancelarEdicaoTarefa();
                    }

                    if (
                        horarioEmEdicao &&
                        !horarios.some(h => h.id === horarioEmEdicao)
                    ) {
                        cancelarEdicaoHorario();
                    }

                    renderizarMaterias();
                    renderizarAnotacoes();
                    renderizarTarefas();
                    renderizarHorarios();

                } catch (erro) {
                    console.error("Erro ao excluir matéria:", erro);
                    alert(erro.message);
                    excluir.disabled = false;
                }
            });

            rodape.appendChild(excluir);
            card.appendChild(rodape);
            listaMaterias.appendChild(card);
        });

        if (materias.length === 0) {
            const mensagem = document.createElement("p");
            mensagem.className = "muted";
            mensagem.textContent = "Você ainda não cadastrou nenhuma matéria.";
            listaMaterias.appendChild(mensagem);
        }

        atualizarResumo();
        atualizarSeletoresMaterias();
    }

    formMateria.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const nome = campoNome.value.trim();
        const professor = campoProfessor.value.trim();
        const horario = campoHorario.value.trim();

        if (!nome) {
            alert("Digite o nome da matéria.");
            return;
        }

        const botao = formMateria.querySelector('[type="submit"]');
        if (botao) botao.disabled = true;

        try {
            const dados = await requisicaoAPI("/api/materias", {
                method: "POST",
                body: JSON.stringify({
                    nome,
                    professor,
                    horario
                })
            });

            materias.unshift(dados.materia);

            formMateria.reset();
            renderizarMaterias();

        } catch (erro) {
            console.error("Erro ao cadastrar matéria:", erro);
            alert(erro.message);
        } finally {
            if (botao) botao.disabled = false;
        }
    });

    // =====================================
    // ANOTAÇÕES
    // =====================================

    function cancelarEdicao() {
        anotacaoEmEdicao = null;
        formAnotacao.reset();
        btnSalvarAnotacao.textContent = "Salvar anotação";
        btnCancelarEdicao.hidden = true;
    }

    btnCancelarEdicao.addEventListener("click", cancelarEdicao);

    formAnotacao.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const materiaId = selectMateria.value;
        const titulo = campoTitulo.value.trim();
        const texto = campoTexto.value.trim();
        const idEdicao = anotacaoEmEdicao;

        if (!materias.some(m => String(m.id) === String(materiaId))) {
            alert("Cadastre e selecione uma matéria válida primeiro.");
            return;
        }

        if (!titulo || !texto) {
            alert("Preencha o título e o conteúdo da anotação.");
            return;
        }

        const corpo = JSON.stringify({
            materiaId,
            titulo,
            data: campoData.value,
            texto
        });

        btnSalvarAnotacao.disabled = true;

        try {
            if (idEdicao) {
                const dados = await requisicaoAPI(
                    "/api/anotacoes/" + encodeURIComponent(idEdicao),
                    { method: "PUT", body: corpo }
                );

                anotacoes = anotacoes.map(a =>
                    a.id === idEdicao ? dados.anotacao : a
                );

            } else {
                const dados = await requisicaoAPI("/api/anotacoes", {
                    method: "POST",
                    body: corpo
                });

                anotacoes.unshift(dados.anotacao);
            }

            cancelarEdicao();
            renderizarAnotacoes();

        } catch (erro) {
            console.error("Erro ao salvar anotação:", erro);
            alert(erro.message);
        } finally {
            btnSalvarAnotacao.disabled = false;
        }
    });

    function renderizarAnotacoes() {
        listaAnotacoes.replaceChildren();

        totalAnotacoes.textContent =
            anotacoes.length +
            (anotacoes.length === 1 ? " anotação" : " anotações");

        if (anotacoes.length === 0) {
            const mensagem = document.createElement("p");
            mensagem.className = "muted";
            mensagem.textContent = "Suas anotações aparecerão aqui.";
            listaAnotacoes.appendChild(mensagem);
            return;
        }

        anotacoes.forEach(function (anotacao) {
            const materia = materias.find(m => m.id === anotacao.materiaId);
            if (!materia) return;

            const card = document.createElement("article");
            card.className = "anotacao-card";

            const etiqueta = document.createElement("span");
            etiqueta.className = "black-tag";
            etiqueta.textContent = materia.nome;
            card.appendChild(etiqueta);

            const titulo = document.createElement("h4");
            titulo.textContent = anotacao.titulo;
            card.appendChild(titulo);

            const meta = document.createElement("p");
            meta.className = "anotacao-meta";
            meta.textContent = anotacao.data
                ? "Data da aula: " + formatarData(anotacao.data)
                : "Data da aula não informada";
            card.appendChild(meta);

            const conteudo = document.createElement("p");
            conteudo.className = "anotacao-conteudo";
            conteudo.textContent = anotacao.texto;
            card.appendChild(conteudo);

            const acoes = document.createElement("div");
            acoes.className = "anotacao-acoes";

            const editar = document.createElement("button");
            editar.type = "button";
            editar.className = "btn-edit";
            editar.textContent = "Editar";

            editar.addEventListener("click", function () {
                anotacaoEmEdicao = anotacao.id;
                selectMateria.value = anotacao.materiaId;
                campoTitulo.value = anotacao.titulo;
                campoData.value = anotacao.data || "";
                campoTexto.value = anotacao.texto;

                btnSalvarAnotacao.textContent = "Salvar alterações";
                btnCancelarEdicao.hidden = false;

                formAnotacao.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                campoTitulo.focus();
            });

            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "btn-delete";
            excluir.textContent = "Excluir";

            excluir.addEventListener("click", async function () {
                if (!confirm('Excluir a anotação "' + anotacao.titulo + '"?')) {
                    return;
                }

                excluir.disabled = true;

                try {
                    await requisicaoAPI(
                        "/api/anotacoes/" + encodeURIComponent(anotacao.id),
                        { method: "DELETE" }
                    );

                    anotacoes = anotacoes.filter(a => a.id !== anotacao.id);

                    if (anotacaoEmEdicao === anotacao.id) {
                        cancelarEdicao();
                    }

                    renderizarAnotacoes();

                } catch (erro) {
                    console.error("Erro ao excluir anotação:", erro);
                    alert(erro.message);
                    excluir.disabled = false;
                }
            });

            acoes.appendChild(editar);
            acoes.appendChild(excluir);
            card.appendChild(acoes);
            listaAnotacoes.appendChild(card);
        });
    }

    // =====================================
    // TAREFAS, PROVAS E LEMBRETES
    // =====================================

    const formTarefa = document.getElementById("form-tarefa");
    const campoTituloTarefa = document.getElementById("titulo-tarefa");
    const selectMateriaTarefa = document.getElementById("materia-tarefa");
    const campoTipoTarefa = document.getElementById("tipo-tarefa");
    const campoDataTarefa = document.getElementById("data-tarefa");
    const campoPrioridadeTarefa = document.getElementById("prioridade-tarefa");
    const listaTarefas = document.getElementById("lista-tarefas");
    const totalTarefas = document.getElementById("total-tarefas");
    const botoesFiltro = document.querySelectorAll(".filtro-tarefa");
    const mensagemPandy = document.querySelector(".panda-message");

    const btnSalvarTarefa = formTarefa.querySelector('[type="submit"]');

    const btnCancelarTarefa = document.createElement("button");
    btnCancelarTarefa.type = "button";
    btnCancelarTarefa.className = "btn-delete btn-cancelar-form";
    btnCancelarTarefa.textContent = "Cancelar edição";
    btnCancelarTarefa.hidden = true;
    btnSalvarTarefa.after(btnCancelarTarefa);

    function cancelarEdicaoTarefa() {
        tarefaEmEdicao = null;
        formTarefa.reset();
        formTarefa.classList.remove("editando");
        btnSalvarTarefa.textContent = "+ Adicionar à agenda";
        btnCancelarTarefa.hidden = true;
    }

    btnCancelarTarefa.addEventListener("click", cancelarEdicaoTarefa);

    const tiposPermitidos = [
        "Atividade", "Prova", "Trabalho", "Leitura", "Outro"
    ];

    const prioridadesPermitidas = ["Normal", "Alta", "Urgente"];

    function dataLocalHoje() {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const dia = String(agora.getDate()).padStart(2, "0");
        return ano + "-" + mes + "-" + dia;
    }

    function formatarData(data) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return "Data não informada";
        }

        const partes = data.split("-");
        return partes[2] + "/" + partes[1] + "/" + partes[0];
    }

    function atualizarResumoTarefas() {
        const cartoes = document.querySelectorAll(".summary-card");

        const pendentes = tarefas.filter(t => !t.concluida).length;
        const concluidas = tarefas.filter(t => t.concluida).length;

        if (cartoes[1]) {
            cartoes[1].querySelector("strong").textContent = pendentes;
        }

        if (cartoes[2]) {
            cartoes[2].querySelector("strong").textContent = concluidas;
        }
    }

    function atualizarRecadoPandy() {
        if (!mensagemPandy) return;

        const pendentes = tarefas.filter(t => !t.concluida);
        const hoje = dataLocalHoje();

        const atrasadas = pendentes.filter(t => t.data < hoje);

        const proximas = pendentes.filter(t => t.data >= hoje)
            .sort((a, b) => a.data.localeCompare(b.data));

        if (atrasadas.length > 0) {
            mensagemPandy.textContent =
                "Vamos lá! Você tem " + atrasadas.length +
                (atrasadas.length === 1
                    ? " atividade atrasada. Que tal organizar essa pendência?"
                    : " atividades atrasadas. Que tal organizar essas pendências?");
        } else if (proximas.length > 0) {
            const proxima = proximas[0];
            const materia = materias.find(m => m.id === proxima.materiaId);

            mensagemPandy.textContent =
                "Sua próxima atividade é " + proxima.titulo +
                ", com prazo em " + formatarData(proxima.data) +
                (materia ? ", de " + materia.nome : "") +
                ". Vamos nos preparar?";
        } else {
            mensagemPandy.textContent =
                "Tudo tranquilo por enquanto! Cadastre suas próximas atividades " +
                "e vamos organizar seus estudos juntos.";
        }
    }

    function renderizarTarefas() {
        listaTarefas.replaceChildren();

        totalTarefas.textContent =
            tarefas.length +
            (tarefas.length === 1 ? " tarefa" : " tarefas");

        atualizarResumoTarefas();
        atualizarRecadoPandy();

        const hoje = dataLocalHoje();

        const tarefasVisiveis = tarefas.filter(function (t) {
            if (filtroAtual === "pendentes") return !t.concluida;
            if (filtroAtual === "concluidas") return t.concluida;
            return true;
        });

        tarefasVisiveis.sort(function (a, b) {
            if (a.concluida !== b.concluida) {
                return a.concluida ? 1 : -1;
            }

            return a.data.localeCompare(b.data);
        });

        if (tarefasVisiveis.length === 0) {
            const mensagem = document.createElement("p");
            mensagem.className = "tarefa-vazia";

            mensagem.textContent = tarefas.length === 0
                ? "Você ainda não cadastrou atividades. Adicione sua primeira tarefa acima!"
                : "Não há tarefas nesta categoria.";

            listaTarefas.appendChild(mensagem);
            return;
        }

        tarefasVisiveis.forEach(function (tarefa) {
            const materia = materias.find(m => m.id === tarefa.materiaId);
            const atrasada = !tarefa.concluida && tarefa.data < hoje;

            const card = document.createElement("article");
            card.className = "tarefa-card";

            if (tarefa.concluida) card.classList.add("concluida");

            const topo = document.createElement("div");
            topo.className = "tarefa-topo";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "tarefa-check";
            checkbox.checked = tarefa.concluida;
            checkbox.setAttribute(
                "aria-label",
                "Marcar " + tarefa.titulo + " como concluída"
            );

            checkbox.addEventListener("change", async function () {
                const anterior = tarefa.concluida;
                const novoValor = checkbox.checked;

                checkbox.disabled = true;

                try {
                    await requisicaoAPI(
                        "/api/tarefas/" + encodeURIComponent(tarefa.id),
                        {
                            method: "PATCH",
                            body: JSON.stringify({ concluida: novoValor })
                        }
                    );

                    tarefa.concluida = novoValor;
                    renderizarTarefas();

                } catch (erro) {
                    console.error("Erro ao atualizar tarefa:", erro);
                    alert(erro.message);

                    tarefa.concluida = anterior;
                    checkbox.checked = anterior;
                    checkbox.disabled = false;
                }
            });

            const info = document.createElement("div");
            info.className = "tarefa-info";

            const titulo = document.createElement("h4");
            titulo.textContent = tarefa.titulo;
            info.appendChild(titulo);

            const meta = document.createElement("p");
            meta.className = "tarefa-meta";
            meta.textContent =
                (materia ? materia.nome : "Matéria removida") +
                " · Prazo: " + formatarData(tarefa.data);

            info.appendChild(meta);
            topo.appendChild(checkbox);
            topo.appendChild(info);
            card.appendChild(topo);

            const etiquetas = document.createElement("div");
            etiquetas.className = "tarefa-etiquetas";

            function adicionarEtiqueta(texto, destaque, atrasadaTag) {
                const etiqueta = document.createElement("span");
                etiqueta.className = "tarefa-etiqueta";

                if (destaque) etiqueta.classList.add("destaque");
                if (atrasadaTag) etiqueta.classList.add("atrasada");

                etiqueta.textContent = texto;
                etiquetas.appendChild(etiqueta);
            }

            adicionarEtiqueta(tarefa.tipo || "Atividade", false, false);
            adicionarEtiqueta(
                tarefa.prioridade || "Normal",
                tarefa.prioridade === "Urgente",
                false
            );

            if (tarefa.concluida) {
                adicionarEtiqueta("Concluída", false, false);
            } else if (atrasada) {
                adicionarEtiqueta("Prazo atrasado", false, true);
            } else if (tarefa.data === hoje) {
                adicionarEtiqueta("Prazo hoje", true, false);
            }

            card.appendChild(etiquetas);

            const acoes = document.createElement("div");
            acoes.className = "tarefa-acoes";

            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "btn-delete";
            excluir.textContent = "Excluir";

            excluir.addEventListener("click", async function () {
                if (!confirm('Excluir a tarefa "' + tarefa.titulo + '"?')) {
                    return;
                }

                excluir.disabled = true;

                try {
                    await requisicaoAPI(
                        "/api/tarefas/" + encodeURIComponent(tarefa.id),
                        { method: "DELETE" }
                    );

                    tarefas = tarefas.filter(t => t.id !== tarefa.id);

                    if (tarefaEmEdicao === tarefa.id) {
                        cancelarEdicaoTarefa();
                    }

                    renderizarTarefas();

                } catch (erro) {
                    console.error("Erro ao excluir tarefa:", erro);
                    alert(erro.message);
                    excluir.disabled = false;
                }
            });

            const editar = document.createElement("button");
            editar.type = "button";
            editar.className = "btn-edit";
            editar.textContent = "Editar";

            editar.addEventListener("click", function () {
                tarefaEmEdicao = tarefa.id;

                campoTituloTarefa.value = tarefa.titulo;
                selectMateriaTarefa.value = tarefa.materiaId;
                campoTipoTarefa.value = tarefa.tipo;
                campoDataTarefa.value = tarefa.data;
                campoPrioridadeTarefa.value = tarefa.prioridade;

                btnSalvarTarefa.textContent = "Salvar alterações";
                btnCancelarTarefa.hidden = false;
                formTarefa.classList.add("editando");

                formTarefa.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                campoTituloTarefa.focus();
            });

            acoes.appendChild(editar);
            acoes.appendChild(excluir);
            card.appendChild(acoes);
            listaTarefas.appendChild(card);
        });
    }

    formTarefa.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const titulo = campoTituloTarefa.value.trim();
        const materiaId = selectMateriaTarefa.value;
        const data = campoDataTarefa.value;

        if (!titulo) {
            alert("Digite o nome da atividade.");
            return;
        }

        if (!materias.some(m => m.id === materiaId)) {
            alert("Cadastre e selecione uma matéria primeiro.");
            return;
        }

        if (!data) {
            alert("Selecione a data do prazo.");
            return;
        }

        if (
            !tiposPermitidos.includes(campoTipoTarefa.value) ||
            !prioridadesPermitidas.includes(campoPrioridadeTarefa.value)
        ) {
            alert("Selecione um tipo e uma prioridade válidos.");
            return;
        }

        const botao = btnSalvarTarefa;
        const idEdicao = tarefaEmEdicao;
        botao.disabled = true;

        const corpo = JSON.stringify({
            titulo,
            materiaId,
            tipo: campoTipoTarefa.value,
            data,
            prioridade: campoPrioridadeTarefa.value
        });

        try {
            if (idEdicao) {
                const dados = await requisicaoAPI(
                    "/api/tarefas/" + encodeURIComponent(idEdicao),
                    { method: "PUT", body: corpo }
                );

                tarefas = tarefas.map(t =>
                    t.id === idEdicao ? dados.tarefa : t
                );

            } else {
                const dados = await requisicaoAPI("/api/tarefas", {
                    method: "POST",
                    body: corpo
                });

                tarefas.push(dados.tarefa);
            }

            cancelarEdicaoTarefa();
            filtroAtual = "todas";

            botoesFiltro.forEach(function (botaoFiltro) {
                botaoFiltro.classList.toggle(
                    "active",
                    botaoFiltro.dataset.filtro === filtroAtual
                );
            });

            renderizarTarefas();

        } catch (erro) {
            console.error("Erro ao cadastrar tarefa:", erro);
            alert(erro.message);
        } finally {
            if (botao) botao.disabled = false;
        }
    });

    botoesFiltro.forEach(function (botao) {
        botao.addEventListener("click", function () {
            filtroAtual = botao.dataset.filtro;

            botoesFiltro.forEach(function (outro) {
                outro.classList.toggle("active", outro === botao);
            });

            renderizarTarefas();
        });
    });

    // =====================================
    // HORÁRIOS DE ESTUDO
    // =====================================

    const formHorario = document.getElementById("form-horario");
    const selectMateriaHorario = document.getElementById("materia-horario");
    const selectDiaHorario = document.getElementById("dia-horario");
    const inputInicioHorario = document.getElementById("inicio-horario");
    const inputFimHorario = document.getElementById("fim-horario");
    const inputObjetivoHorario = document.getElementById("objetivo-horario");
    const listaHorarios = document.getElementById("lista-horarios");
    const totalHorarios = document.getElementById("total-horarios");

    const btnSalvarHorario = formHorario.querySelector('[type="submit"]');

    const btnCancelarHorario = document.createElement("button");
    btnCancelarHorario.type = "button";
    btnCancelarHorario.className = "btn-delete btn-cancelar-form";
    btnCancelarHorario.textContent = "Cancelar edição";
    btnCancelarHorario.hidden = true;
    btnSalvarHorario.after(btnCancelarHorario);

    function cancelarEdicaoHorario() {
        horarioEmEdicao = null;
        formHorario.reset();
        formHorario.classList.remove("editando");
        btnSalvarHorario.textContent = "+ Adicionar horário";
        btnCancelarHorario.hidden = true;
    }

    btnCancelarHorario.addEventListener("click", cancelarEdicaoHorario);

    const diasDaSemana = [
        { valor: "segunda", nome: "Segunda-feira" },
        { valor: "terca", nome: "Terça-feira" },
        { valor: "quarta", nome: "Quarta-feira" },
        { valor: "quinta", nome: "Quinta-feira" },
        { valor: "sexta", nome: "Sexta-feira" },
        { valor: "sabado", nome: "Sábado" },
        { valor: "domingo", nome: "Domingo" }
    ];

    function criarTexto(texto, classe) {
        const elemento = document.createElement("p");
        elemento.className = classe;
        elemento.textContent = texto;
        return elemento;
    }

    function renderizarHorarios() {
        listaHorarios.replaceChildren();

        const horariosOrdenados = [...horarios].sort((a, b) => {
            const diaA = diasDaSemana.findIndex(d => d.valor === a.dia);
            const diaB = diasDaSemana.findIndex(d => d.valor === b.dia);

            if (diaA !== diaB) return diaA - diaB;

            return a.inicio.localeCompare(b.inicio);
        });

        totalHorarios.textContent =
            `${horarios.length} ${horarios.length === 1 ? "horário" : "horários"}`;

        if (horariosOrdenados.length === 0) {
            listaHorarios.appendChild(
                criarTexto(
                    "Nenhum horário cadastrado ainda. Adicione o primeiro acima!",
                    "horario-vazio"
                )
            );
            return;
        }

        diasDaSemana.forEach(dia => {
            const horariosDoDia = horariosOrdenados.filter(
                horario => horario.dia === dia.valor
            );

            if (horariosDoDia.length === 0) return;

            const grupo = document.createElement("div");
            grupo.className = "horario-grupo";

            const tituloDia = document.createElement("h4");
            tituloDia.className = "horario-dia";
            tituloDia.textContent = dia.nome;
            grupo.appendChild(tituloDia);

            horariosDoDia.forEach(horario => {
                const card = document.createElement("article");
                card.className = "horario-card";

                const info = document.createElement("div");
                info.className = "horario-info";

                const materia = materias.find(
                    item => item.id === horario.materiaId
                );

                info.appendChild(
                    criarTexto(
                        materia ? materia.nome : "Matéria não encontrada",
                        "horario-materia"
                    )
                );

                info.appendChild(
                    criarTexto(
                        `${horario.inicio} – ${horario.fim}`,
                        "horario-tempo"
                    )
                );

                if (horario.objetivo) {
                    info.appendChild(
                        criarTexto(horario.objetivo, "horario-objetivo")
                    );
                }

                const botaoExcluir = document.createElement("button");
                botaoExcluir.type = "button";
                botaoExcluir.className = "btn-excluir-horario";
                botaoExcluir.textContent = "Excluir";
                botaoExcluir.setAttribute(
                    "aria-label",
                    "Excluir horário de estudo"
                );

                botaoExcluir.addEventListener("click", async () => {
                    if (!confirm("Deseja excluir este horário de estudo?")) {
                        return;
                    }

                    botaoExcluir.disabled = true;

                    try {
                        await requisicaoAPI(
                            "/api/horarios/" + encodeURIComponent(horario.id),
                            { method: "DELETE" }
                        );

                        horarios = horarios.filter(
                            item => item.id !== horario.id
                        );

                        if (horarioEmEdicao === horario.id) {
                            cancelarEdicaoHorario();
                        }

                        renderizarHorarios();

                    } catch (erro) {
                        console.error("Erro ao excluir horário:", erro);
                        alert(erro.message);
                        botaoExcluir.disabled = false;
                    }
                });

                const botaoEditar = document.createElement("button");
                botaoEditar.type = "button";
                botaoEditar.className = "btn-excluir-horario";
                botaoEditar.textContent = "Editar";
                botaoEditar.setAttribute(
                    "aria-label",
                    "Editar horário de estudo"
                );

                botaoEditar.addEventListener("click", () => {
                    horarioEmEdicao = horario.id;

                    selectMateriaHorario.value = horario.materiaId;
                    selectDiaHorario.value = horario.dia;
                    inputInicioHorario.value = horario.inicio;
                    inputFimHorario.value = horario.fim;
                    inputObjetivoHorario.value = horario.objetivo || "";

                    btnSalvarHorario.textContent = "Salvar alterações";
                    btnCancelarHorario.hidden = false;
                    formHorario.classList.add("editando");

                    formHorario.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                    selectMateriaHorario.focus();
                });

                const acoesHorario = document.createElement("div");
                acoesHorario.className = "horario-acoes";
                acoesHorario.append(botaoEditar, botaoExcluir);

                card.append(info, acoesHorario);
                grupo.appendChild(card);
            });

            listaHorarios.appendChild(grupo);
        });
    }

    formHorario.addEventListener("submit", async evento => {
        evento.preventDefault();

        const materiaId = selectMateriaHorario.value;
        const dia = selectDiaHorario.value;
        const inicio = inputInicioHorario.value;
        const fim = inputFimHorario.value;
        const objetivo = inputObjetivoHorario.value.trim();

        if (!materias.some(m => m.id === materiaId)) {
            alert("Cadastre ou selecione uma matéria primeiro.");
            return;
        }

        if (!diasDaSemana.some(item => item.valor === dia)) {
            alert("Selecione um dia da semana.");
            return;
        }

        if (!inicio || !fim || fim <= inicio) {
            alert("O horário de término precisa ser depois do horário de início.");
            return;
        }

        const botao = btnSalvarHorario;
        const idEdicao = horarioEmEdicao;
        botao.disabled = true;

        const corpo = JSON.stringify({
            materiaId,
            dia,
            inicio,
            fim,
            objetivo
        });

        try {
            if (idEdicao) {
                const dados = await requisicaoAPI(
                    "/api/horarios/" + encodeURIComponent(idEdicao),
                    { method: "PUT", body: corpo }
                );

                horarios = horarios.map(h =>
                    h.id === idEdicao ? dados.horario : h
                );

            } else {
                const dados = await requisicaoAPI("/api/horarios", {
                    method: "POST",
                    body: corpo
                });

                horarios.push(dados.horario);
            }

            cancelarEdicaoHorario();
            renderizarHorarios();

        } catch (erro) {
            console.error("Erro ao cadastrar horário:", erro);
            alert(erro.message);
        } finally {
            if (botao) botao.disabled = false;
        }
    });

    // =====================================
    // INICIALIZAÇÃO
    // =====================================

    const resultados = await Promise.all([
        carregarLista("/api/materias", "materias"),
        carregarLista("/api/anotacoes", "anotacoes"),
        carregarLista("/api/tarefas", "tarefas"),
        carregarLista("/api/horarios", "horarios")
    ]);

    if (resultados.some(lista => lista === null)) {
        alert("Não foi possível carregar todos os seus dados. Confira se o servidor está funcionando.");
    }

    materias = resultados[0] || [];
    anotacoes = resultados[1] || [];
    tarefas = resultados[2] || [];
    horarios = resultados[3] || [];

    renderizarMaterias();
    renderizarAnotacoes();
    renderizarTarefas();
    renderizarHorarios();
    atualizarResumo();

    console.log("Pandy Study iniciado com sucesso!");
});