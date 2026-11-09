require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;

// VERIFICAR CONFIGURAÇÃO DA SESSÃO
if (!process.env.SESSION_SECRET) {
    throw new Error("Configure SESSION_SECRET no arquivo .env");
}

// LOCALIZAR A PASTA DO SITE
const pastaSite = path.resolve(__dirname, "pandy-study-main");
const arquivoLogin = path.join(pastaSite, "login.html");

console.log("--------------------------------");
console.log("VERIFICAÇÃO DOS ARQUIVOS");
console.log("Pasta do site:", pastaSite);
console.log("Login encontrado:", fs.existsSync(arquivoLogin));
console.log("--------------------------------");

if (!fs.existsSync(arquivoLogin)) {
    throw new Error("O arquivo login.html não foi encontrado na pasta do site.");
}

// CONEXÃO COM MYSQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

// CRIAR AS TABELAS (E CONSERTAR AS QUE ESTÃO COM COLUNAS ANTIGAS)
async function tabelaComColunasErradas(tabela, colunas) {
    const [existe] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tabela]
    );

    if (existe[0].total === 0) return false;

    const [encontradas] = await db.query(
        `SELECT COUNT(DISTINCT column_name) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = ?
           AND column_name IN (?)`,
        [tabela, colunas]
    );

    return encontradas[0].total !== colunas.length;
}

async function guardarTabelaAntiga(tabela) {
    const nomeBackup = tabela + "_antiga_" + Date.now();

    await db.query(
        "RENAME TABLE `" + tabela + "` TO `" + nomeBackup + "`"
    );

    console.log(
        "A tabela " + tabela + " estava com colunas antigas. " +
        "Foi renomeada para " + nomeBackup + " e uma nova será criada."
    );
}

async function criarTabelas() {
    const estruturas = [
        {
            nome: "tarefas",
            colunas: [
                "usuario_id", "materia_id", "titulo", "tipo",
                "data_prazo", "prioridade", "concluida"
            ],
            sql: `
                CREATE TABLE IF NOT EXISTS tarefas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    materia_id INT NOT NULL,
                    titulo VARCHAR(150) NOT NULL,
                    tipo VARCHAR(20) NOT NULL DEFAULT 'Atividade',
                    data_prazo DATE NOT NULL,
                    prioridade VARCHAR(20) NOT NULL DEFAULT 'Normal',
                    concluida TINYINT(1) NOT NULL DEFAULT 0,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_tarefas_usuario FOREIGN KEY (usuario_id)
                        REFERENCES usuarios(id) ON DELETE CASCADE,
                    CONSTRAINT fk_tarefas_materia FOREIGN KEY (materia_id)
                        REFERENCES materias(id) ON DELETE CASCADE
                )
            `
        },
        {
            nome: "anotacoes",
            colunas: [
                "usuario_id", "materia_id", "titulo",
                "data_aula", "texto", "criado_em"
            ],
            sql: `
                CREATE TABLE IF NOT EXISTS anotacoes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    materia_id INT NOT NULL,
                    titulo VARCHAR(150) NOT NULL,
                    data_aula DATE NULL,
                    texto TEXT NOT NULL,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_anotacoes_usuario FOREIGN KEY (usuario_id)
                        REFERENCES usuarios(id) ON DELETE CASCADE,
                    CONSTRAINT fk_anotacoes_materia FOREIGN KEY (materia_id)
                        REFERENCES materias(id) ON DELETE CASCADE
                )
            `
        },
        {
            nome: "horarios",
            colunas: [
                "usuario_id", "materia_id", "dia",
                "inicio", "fim", "objetivo", "criado_em"
            ],
            sql: `
                CREATE TABLE IF NOT EXISTS horarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    materia_id INT NOT NULL,
                    dia VARCHAR(10) NOT NULL,
                    inicio TIME NOT NULL,
                    fim TIME NOT NULL,
                    objetivo VARCHAR(255) NULL,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_horarios_usuario FOREIGN KEY (usuario_id)
                        REFERENCES usuarios(id) ON DELETE CASCADE,
                    CONSTRAINT fk_horarios_materia FOREIGN KEY (materia_id)
                        REFERENCES materias(id) ON DELETE CASCADE
                )
            `
        }
    ];

    for (const estrutura of estruturas) {
        if (await tabelaComColunasErradas(estrutura.nome, estrutura.colunas)) {
            await guardarTabelaAntiga(estrutura.nome);
        }

        await db.query(estrutura.sql);
    }
}

// CONFIGURAÇÕES GERAIS
app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5500",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5500"
    ].filter(Boolean),
    credentials: true
}));

app.use(express.json());

// CONFIGURAÇÃO DE SESSÃO
app.use(session({
    name: "pandy.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// VERIFICAR SE O USUÁRIO ESTÁ LOGADO
function exigirAutenticacao(req, res, next) {
    if (!req.session || !req.session.usuarioId) {
        return res.status(401).json({
            mensagem: "Usuário não autenticado."
        });
    }

    next();
}

// SERVIR OS ARQUIVOS DO SITE
app.use(express.static(pastaSite, {
    index: false,
    extensions: ["html"]
}));

// PÁGINA INICIAL
app.get("/", (req, res) => {
    res.sendFile(arquivoLogin);
});

// VERIFICAR SERVIDOR
app.get("/api/status", (req, res) => {
    res.json({
        mensagem: "Servidor Pandy Study funcionando!"
    });
});

// VERIFICAR MYSQL
app.get("/api/db-check", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            mensagem: "Conexão com o banco de dados estabelecida!"
        });
    } catch (erro) {
        console.error("Erro no MySQL:", erro);

        res.status(500).json({
            mensagem: "Erro na conexão com MySQL.",
            detalhe: erro.message
        });
    }
});

// ==========================================
// MATÉRIAS
// ==========================================

// LISTAR MATÉRIAS DO USUÁRIO LOGADO
app.get("/api/materias", exigirAutenticacao, async (req, res) => {
    try {
        const [materias] = await db.query(
            `SELECT id, nome, professor, horario, cor, criado_em
             FROM materias
             WHERE usuario_id = ?
             ORDER BY criado_em DESC`,
            [req.session.usuarioId]
        );

        res.json({
            materias: materias.map(materia => ({
                ...materia,
                id: String(materia.id)
            }))
        });

    } catch (erro) {
        console.error("Erro ao buscar matérias:", erro);

        res.status(500).json({
            mensagem: "Erro ao carregar matérias.",
            detalhe: erro.message
        });
    }
});

// CADASTRAR MATÉRIA
app.post("/api/materias", exigirAutenticacao, async (req, res) => {
    try {
        const { nome, professor, horario } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({
                mensagem: "Informe o nome da matéria."
            });
        }

        if (nome.trim().length > 100) {
            return res.status(400).json({
                mensagem: "O nome da matéria deve ter até 100 caracteres."
            });
        }

        if (professor && professor.length > 100) {
            return res.status(400).json({
                mensagem: "O nome do professor deve ter até 100 caracteres."
            });
        }

        if (horario && horario.length > 100) {
            return res.status(400).json({
                mensagem: "O horário deve ter até 100 caracteres."
            });
        }

        const [resultado] = await db.query(
            `INSERT INTO materias
             (usuario_id, nome, professor, horario)
             VALUES (?, ?, ?, ?)`,
            [
                req.session.usuarioId,
                nome.trim(),
                professor ? professor.trim() : null,
                horario ? horario.trim() : null
            ]
        );

        const novaMateria = {
            id: String(resultado.insertId),
            nome: nome.trim(),
            professor: professor ? professor.trim() : "",
            horario: horario ? horario.trim() : ""
        };

        console.log("Matéria cadastrada:", novaMateria.nome);

        res.status(201).json({
            mensagem: "Matéria cadastrada com sucesso!",
            materia: novaMateria
        });

    } catch (erro) {
        console.error("Erro ao cadastrar matéria:", erro);

        res.status(500).json({
            mensagem: "Erro ao cadastrar matéria.",
            detalhe: erro.message
        });
    }
});

// EXCLUIR MATÉRIA
app.delete("/api/materias/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^\d+$/.test(id)) {
            return res.status(400).json({
                mensagem: "ID da matéria inválido."
            });
        }

        const [resultado] = await db.query(
            `DELETE FROM materias
             WHERE id = ? AND usuario_id = ?`,
            [id, req.session.usuarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Matéria não encontrada."
            });
        }

        res.json({
            mensagem: "Matéria excluída com sucesso!"
        });

    } catch (erro) {
        console.error("Erro ao excluir matéria:", erro);

        res.status(500).json({
            mensagem: "Erro ao excluir matéria.",
            detalhe: erro.message
        });
    }
});

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

const TIPOS_TAREFA = ["Atividade", "Prova", "Trabalho", "Leitura", "Outro"];
const PRIORIDADES = ["Normal", "Alta", "Urgente"];
const DIAS_SEMANA = [
    "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"
];

function idValido(valor) {
    return /^\d+$/.test(String(valor));
}

function dataValida(valor) {
    return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function horaValida(valor) {
    return typeof valor === "string" && /^\d{2}:\d{2}$/.test(valor);
}

async function materiaDoUsuario(materiaId, usuarioId) {
    if (!idValido(materiaId)) return false;

    const [linhas] = await db.query(
        "SELECT id FROM materias WHERE id = ? AND usuario_id = ?",
        [materiaId, usuarioId]
    );

    return linhas.length > 0;
}

function erroServidor(res, mensagem, erro) {
    console.error(mensagem, erro);

    res.status(500).json({
        mensagem,
        detalhe: erro.message
    });
}

// ==========================================
// TAREFAS
// ==========================================

async function validarTarefa(corpo, usuarioId) {
    const { titulo, materiaId, tipo, data, prioridade } = corpo;

    if (typeof titulo !== "string" || !titulo.trim()) {
        return "Informe o nome da atividade.";
    }

    if (titulo.trim().length > 150) {
        return "O nome da atividade deve ter até 150 caracteres.";
    }

    if (!(await materiaDoUsuario(materiaId, usuarioId))) {
        return "Matéria inválida.";
    }

    if (!dataValida(data)) {
        return "Informe uma data de prazo válida.";
    }

    if (!TIPOS_TAREFA.includes(tipo) || !PRIORIDADES.includes(prioridade)) {
        return "Tipo ou prioridade inválidos.";
    }

    return null;
}

async function validarHorario(corpo, usuarioId) {
    const { materiaId, dia, inicio, fim, objetivo } = corpo;

    if (!(await materiaDoUsuario(materiaId, usuarioId))) {
        return "Matéria inválida.";
    }

    if (!DIAS_SEMANA.includes(dia)) {
        return "Dia da semana inválido.";
    }

    if (!horaValida(inicio) || !horaValida(fim) || fim <= inicio) {
        return "O horário de término precisa ser depois do início.";
    }

    if (objetivo && String(objetivo).length > 255) {
        return "O objetivo deve ter até 255 caracteres.";
    }

    return null;
}

function formatarTarefa(t) {
    return {
        id: String(t.id),
        materiaId: String(t.materia_id),
        titulo: t.titulo,
        tipo: t.tipo,
        data: t.data_prazo,
        prioridade: t.prioridade,
        concluida: Boolean(t.concluida)
    };
}

// LISTAR TAREFAS
app.get("/api/tarefas", exigirAutenticacao, async (req, res) => {
    try {
        const [linhas] = await db.query(
            `SELECT id, materia_id, titulo, tipo, data_prazo, prioridade, concluida
             FROM tarefas
             WHERE usuario_id = ?
             ORDER BY data_prazo ASC, id ASC`,
            [req.session.usuarioId]
        );

        res.json({ tarefas: linhas.map(formatarTarefa) });

    } catch (erro) {
        erroServidor(res, "Erro ao carregar tarefas.", erro);
    }
});

// CADASTRAR TAREFA
app.post("/api/tarefas", exigirAutenticacao, async (req, res) => {
    try {
        const problema = await validarTarefa(req.body, req.session.usuarioId);

        if (problema) {
            return res.status(400).json({ mensagem: problema });
        }

        const { titulo, materiaId, tipo, data, prioridade } = req.body;

        const [resultado] = await db.query(
            `INSERT INTO tarefas
             (usuario_id, materia_id, titulo, tipo, data_prazo, prioridade)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.session.usuarioId,
                materiaId,
                titulo.trim(),
                tipo,
                data,
                prioridade
            ]
        );

        res.status(201).json({
            mensagem: "Tarefa cadastrada com sucesso!",
            tarefa: {
                id: String(resultado.insertId),
                materiaId: String(materiaId),
                titulo: titulo.trim(),
                tipo,
                data,
                prioridade,
                concluida: false
            }
        });

    } catch (erro) {
        erroServidor(res, "Erro ao cadastrar tarefa.", erro);
    }
});

// EDITAR TAREFA
app.put("/api/tarefas/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID da tarefa inválido."
            });
        }

        const problema = await validarTarefa(req.body, req.session.usuarioId);

        if (problema) {
            return res.status(400).json({ mensagem: problema });
        }

        const { titulo, materiaId, tipo, data, prioridade } = req.body;

        const [resultado] = await db.query(
            `UPDATE tarefas
             SET materia_id = ?, titulo = ?, tipo = ?, data_prazo = ?, prioridade = ?
             WHERE id = ? AND usuario_id = ?`,
            [
                materiaId,
                titulo.trim(),
                tipo,
                data,
                prioridade,
                id,
                req.session.usuarioId
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Tarefa não encontrada."
            });
        }

        const [linhas] = await db.query(
            `SELECT id, materia_id, titulo, tipo, data_prazo, prioridade, concluida
             FROM tarefas WHERE id = ?`,
            [id]
        );

        res.json({
            mensagem: "Tarefa atualizada com sucesso!",
            tarefa: formatarTarefa(linhas[0])
        });

    } catch (erro) {
        erroServidor(res, "Erro ao editar tarefa.", erro);
    }
});

// MARCAR TAREFA COMO CONCLUÍDA OU PENDENTE
app.patch("/api/tarefas/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const { concluida } = req.body;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID da tarefa inválido."
            });
        }

        if (typeof concluida !== "boolean") {
            return res.status(400).json({
                mensagem: "Valor de conclusão inválido."
            });
        }

        const [resultado] = await db.query(
            `UPDATE tarefas SET concluida = ?
             WHERE id = ? AND usuario_id = ?`,
            [concluida ? 1 : 0, id, req.session.usuarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Tarefa não encontrada."
            });
        }

        res.json({ mensagem: "Tarefa atualizada!" });

    } catch (erro) {
        erroServidor(res, "Erro ao atualizar tarefa.", erro);
    }
});

// EXCLUIR TAREFA
app.delete("/api/tarefas/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID da tarefa inválido."
            });
        }

        const [resultado] = await db.query(
            "DELETE FROM tarefas WHERE id = ? AND usuario_id = ?",
            [id, req.session.usuarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Tarefa não encontrada."
            });
        }

        res.json({ mensagem: "Tarefa excluída com sucesso!" });

    } catch (erro) {
        erroServidor(res, "Erro ao excluir tarefa.", erro);
    }
});

// ==========================================
// ANOTAÇÕES
// ==========================================

function formatarAnotacao(a) {
    return {
        id: String(a.id),
        materiaId: String(a.materia_id),
        titulo: a.titulo,
        data: a.data_aula || "",
        texto: a.texto,
        criadaEm: a.criado_em
    };
}

function validarAnotacao(corpo) {
    const { titulo, data, texto } = corpo;

    if (typeof titulo !== "string" || !titulo.trim()) {
        return "Informe o título da anotação.";
    }

    if (titulo.trim().length > 150) {
        return "O título deve ter até 150 caracteres.";
    }

    if (typeof texto !== "string" || !texto.trim()) {
        return "Escreva o conteúdo da anotação.";
    }

    if (texto.length > 10000) {
        return "A anotação deve ter até 10.000 caracteres.";
    }

    if (data && !dataValida(data)) {
        return "Data da aula inválida.";
    }

    return null;
}

// LISTAR ANOTAÇÕES
app.get("/api/anotacoes", exigirAutenticacao, async (req, res) => {
    try {
        const [linhas] = await db.query(
            `SELECT id, materia_id, titulo, data_aula, texto, criado_em
             FROM anotacoes
             WHERE usuario_id = ?
             ORDER BY criado_em DESC, id DESC`,
            [req.session.usuarioId]
        );

        res.json({ anotacoes: linhas.map(formatarAnotacao) });

    } catch (erro) {
        erroServidor(res, "Erro ao carregar anotações.", erro);
    }
});

// CADASTRAR ANOTAÇÃO
app.post("/api/anotacoes", exigirAutenticacao, async (req, res) => {
    try {
        const problema = validarAnotacao(req.body);

        if (problema) {
            return res.status(400).json({ mensagem: problema });
        }

        const { materiaId, titulo, data, texto } = req.body;

        if (!(await materiaDoUsuario(materiaId, req.session.usuarioId))) {
            return res.status(400).json({
                mensagem: "Matéria inválida."
            });
        }

        const [resultado] = await db.query(
            `INSERT INTO anotacoes
             (usuario_id, materia_id, titulo, data_aula, texto)
             VALUES (?, ?, ?, ?, ?)`,
            [
                req.session.usuarioId,
                materiaId,
                titulo.trim(),
                data || null,
                texto.trim()
            ]
        );

        const [linhas] = await db.query(
            `SELECT id, materia_id, titulo, data_aula, texto, criado_em
             FROM anotacoes WHERE id = ?`,
            [resultado.insertId]
        );

        res.status(201).json({
            mensagem: "Anotação salva com sucesso!",
            anotacao: formatarAnotacao(linhas[0])
        });

    } catch (erro) {
        erroServidor(res, "Erro ao salvar anotação.", erro);
    }
});

// EDITAR ANOTAÇÃO
app.put("/api/anotacoes/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID da anotação inválido."
            });
        }

        const problema = validarAnotacao(req.body);

        if (problema) {
            return res.status(400).json({ mensagem: problema });
        }

        const { materiaId, titulo, data, texto } = req.body;

        if (!(await materiaDoUsuario(materiaId, req.session.usuarioId))) {
            return res.status(400).json({
                mensagem: "Matéria inválida."
            });
        }

        const [resultado] = await db.query(
            `UPDATE anotacoes
             SET materia_id = ?, titulo = ?, data_aula = ?, texto = ?
             WHERE id = ? AND usuario_id = ?`,
            [
                materiaId,
                titulo.trim(),
                data || null,
                texto.trim(),
                id,
                req.session.usuarioId
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Anotação não encontrada."
            });
        }

        const [linhas] = await db.query(
            `SELECT id, materia_id, titulo, data_aula, texto, criado_em
             FROM anotacoes WHERE id = ?`,
            [id]
        );

        res.json({
            mensagem: "Anotação atualizada com sucesso!",
            anotacao: formatarAnotacao(linhas[0])
        });

    } catch (erro) {
        erroServidor(res, "Erro ao atualizar anotação.", erro);
    }
});

// EXCLUIR ANOTAÇÃO
app.delete("/api/anotacoes/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID da anotação inválido."
            });
        }

        const [resultado] = await db.query(
            "DELETE FROM anotacoes WHERE id = ? AND usuario_id = ?",
            [id, req.session.usuarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Anotação não encontrada."
            });
        }

        res.json({ mensagem: "Anotação excluída com sucesso!" });

    } catch (erro) {
        erroServidor(res, "Erro ao excluir anotação.", erro);
    }
});

// ==========================================
// HORÁRIOS DE ESTUDO
// ==========================================

function formatarHorario(h) {
    return {
        id: String(h.id),
        materiaId: String(h.materia_id),
        dia: h.dia,
        inicio: String(h.inicio).slice(0, 5),
        fim: String(h.fim).slice(0, 5),
        objetivo: h.objetivo || ""
    };
}

// LISTAR HORÁRIOS
app.get("/api/horarios", exigirAutenticacao, async (req, res) => {
    try {
        const [linhas] = await db.query(
            `SELECT id, materia_id, dia, inicio, fim, objetivo
             FROM horarios
             WHERE usuario_id = ?
             ORDER BY id ASC`,
            [req.session.usuarioId]
        );

        res.json({ horarios: linhas.map(formatarHorario) });

    } catch (erro) {
        erroServidor(res, "Erro ao carregar horários.", erro);
    }
});

// CADASTRAR HORÁRIO
app.post("/api/horarios", exigirAutenticacao, async (req, res) => {
    try {
        const problema = await validarHorario(req.body, req.session.usuarioId);

        if (problema) {
            return res.status(400).json({ mensagem: problema });
        }

        const { materiaId, dia, inicio, fim, objetivo } = req.body;

        const objetivoLimpo = objetivo ? String(objetivo).trim() : "";

        const [resultado] = await db.query(
            `INSERT INTO horarios
             (usuario_id, materia_id, dia, inicio, fim, objetivo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.session.usuarioId,
                materiaId,
                dia,
                inicio,
                fim,
                objetivoLimpo || null
            ]
        );

        res.status(201).json({
            mensagem: "Horário cadastrado com sucesso!",
            horario: {
                id: String(resultado.insertId),
                materiaId: String(materiaId),
                dia,
                inicio,
                fim,
                objetivo: objetivoLimpo
            }
        });

    } catch (erro) {
        erroServidor(res, "Erro ao cadastrar horário.", erro);
    }
});

// EDITAR HORÁRIO
app.put("/api/horarios/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID do horário inválido."
            });
        }

        const problema = await validarHorario(req.body, req.session.usuarioId);

        if (problema) {
            return res.status(400).json({ mensagem: problema });
        }

        const { materiaId, dia, inicio, fim, objetivo } = req.body;
        const objetivoLimpo = objetivo ? String(objetivo).trim() : "";

        const [resultado] = await db.query(
            `UPDATE horarios
             SET materia_id = ?, dia = ?, inicio = ?, fim = ?, objetivo = ?
             WHERE id = ? AND usuario_id = ?`,
            [
                materiaId,
                dia,
                inicio,
                fim,
                objetivoLimpo || null,
                id,
                req.session.usuarioId
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Horário não encontrado."
            });
        }

        const [linhas] = await db.query(
            `SELECT id, materia_id, dia, inicio, fim, objetivo
             FROM horarios WHERE id = ?`,
            [id]
        );

        res.json({
            mensagem: "Horário atualizado com sucesso!",
            horario: formatarHorario(linhas[0])
        });

    } catch (erro) {
        erroServidor(res, "Erro ao editar horário.", erro);
    }
});

// EXCLUIR HORÁRIO
app.delete("/api/horarios/:id", exigirAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;

        if (!idValido(id)) {
            return res.status(400).json({
                mensagem: "ID do horário inválido."
            });
        }

        const [resultado] = await db.query(
            "DELETE FROM horarios WHERE id = ? AND usuario_id = ?",
            [id, req.session.usuarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Horário não encontrado."
            });
        }

        res.json({ mensagem: "Horário excluído com sucesso!" });

    } catch (erro) {
        erroServidor(res, "Erro ao excluir horário.", erro);
    }
});

// ==========================================
// USUÁRIOS
// ==========================================

// CADASTRAR USUÁRIO
app.post("/api/usuarios/cadastro", async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({
                mensagem: "Preencha todos os campos."
            });
        }

        if (senha.length < 6) {
            return res.status(400).json({
                mensagem: "A senha precisa ter pelo menos 6 caracteres."
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const [usuariosExistentes] = await db.query(
            "SELECT id FROM usuarios WHERE email = ?",
            [emailNormalizado]
        );

        if (usuariosExistentes.length > 0) {
            return res.status(409).json({
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        const [resultado] = await db.query(
            "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
            [nome.trim(), emailNormalizado, senhaHash]
        );

        res.status(201).json({
            mensagem: "Usuário cadastrado com sucesso!",
            usuario: {
                id: resultado.insertId,
                nome: nome.trim(),
                email: emailNormalizado
            }
        });

    } catch (erro) {
        console.error("Erro no cadastro:", erro);

        res.status(500).json({
            mensagem: "Erro ao cadastrar usuário."
        });
    }
});

// REALIZAR LOGIN
app.post("/api/usuarios/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                mensagem: "Informe o e-mail e a senha."
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const [usuarios] = await db.query(
            "SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?",
            [emailNormalizado]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: "E-mail ou senha incorretos."
            });
        }

        const usuario = usuarios[0];

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha_hash
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: "E-mail ou senha incorretos."
            });
        }

        req.session.regenerate((erro) => {
            if (erro) {
                console.error("Erro ao criar sessão:", erro);

                return res.status(500).json({
                    mensagem: "Erro ao criar sessão do usuário."
                });
            }

            req.session.usuarioId = usuario.id;

            req.session.save((erro) => {
                if (erro) {
                    console.error("Erro ao salvar sessão:", erro);

                    return res.status(500).json({
                        mensagem: "Erro ao salvar sessão do usuário."
                    });
                }

                console.log("Sessão criada para o usuário:", usuario.id);

                res.json({
                    mensagem: "Login realizado com sucesso!",
                    usuario: {
                        id: usuario.id,
                        nome: usuario.nome,
                        email: usuario.email
                    }
                });
            });
        });

    } catch (erro) {
        console.error("Erro no login:", erro);

        res.status(500).json({
            mensagem: "Erro ao realizar login."
        });
    }
});

// CONSULTAR USUÁRIO LOGADO
app.get("/api/usuarios/me", async (req, res) => {
    try {
        if (!req.session.usuarioId) {
            return res.status(401).json({
                mensagem: "Usuário não autenticado."
            });
        }

        const [usuarios] = await db.query(
            "SELECT id, nome, email FROM usuarios WHERE id = ?",
            [req.session.usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: "Usuário não encontrado."
            });
        }

        res.json({
            usuario: usuarios[0]
        });

    } catch (erro) {
        console.error("Erro ao consultar usuário:", erro);

        res.status(500).json({
            mensagem: "Erro ao consultar usuário."
        });
    }
});

// ENCERRAR SESSÃO
app.post("/api/usuarios/logout", (req, res) => {
    req.session.destroy((erro) => {
        if (erro) {
            console.error("Erro ao encerrar sessão:", erro);

            return res.status(500).json({
                mensagem: "Erro ao encerrar sessão."
            });
        }

        res.clearCookie("pandy.sid", {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: false
        });

        res.json({
            mensagem: "Logout realizado com sucesso!"
        });
    });
});

// ROTA PROTEGIDA
app.get("/api/privado", (req, res) => {
    if (!req.session.usuarioId) {
        return res.status(401).json({
            mensagem: "Acesso não autorizado."
        });
    }

    res.json({
        mensagem: "Você acessou uma rota protegida!",
        usuarioId: req.session.usuarioId
    });
});

// INICIAR SERVIDOR
criarTabelas()
    .then(() => {
        app.listen(PORT, () => {
            console.log("--------------------------------");
            console.log("PANDY STUDY INICIADO!");
            console.log(`Site: http://localhost:${PORT}`);
            console.log(`Login: http://localhost:${PORT}/login.html`);
            console.log("--------------------------------");
        });
    })
    .catch((erro) => {
        console.error("Erro ao preparar o banco de dados:", erro);
        process.exit(1);
    });