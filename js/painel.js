/* =========================================================
   Saúde Fácil — Painel CRM
   O painel lê e atualiza os mesmos registros usados pelo site
   do paciente (sf_usuarios e sf_agendamentos).
   Autenticação e permissões são demonstrativas no navegador.
   ========================================================= */
const $ = id => document.getElementById(id);
const KEYS = {
  equipe: "sf_equipe_usuarios",
  sessao: "sf_equipe_sessao",
  permissoes: "sf_equipe_permissoes",
  auditoria: "sf_equipe_auditoria",
  tema: "sf_tema"
};
const UNIDADES = [
  "UBS Vila Nova",
  "UBS Centro",
  "UPA Zona Leste",
  "UBS Jardim Esperança",
  "UPA Zona Sul"
];
const STATUS = [
  ["agendado", "Agendado"],
  ["confirmado", "Confirmado"],
  ["atendido", "Atendido"],
  ["faltou", "Faltou"],
  ["cancelado", "Cancelado"]
];
const PERMS = {
  "ag.view": "Visualizar agendamentos",
  "ag.edit": "Alterar status dos agendamentos",
  "pac.view": "Visualizar pacientes",
  "all.units": "Visualizar todas as unidades",
  "users.manage": "Gerenciar usuários da equipe",
  "roles.manage": "Gerenciar permissões",
  "audit.view": "Visualizar auditoria"
};
const ROLES = { admin: "Administrador", manager: "Gestor de unidade", staff: "Atendente" };
const DEFAULT_PERMS = {
  admin: Object.keys(PERMS),
  manager: ["ag.view", "ag.edit", "pac.view", "audit.view"],
  staff: ["ag.view", "ag.edit", "pac.view"]
};
let ME = null;
let VIEW = "ag";
let toastTimer = null;

const ler = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const gravar = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const uid = () => "eq-" + Math.random().toString(36).slice(2, 10);
const fmtData = iso => {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
};
const maskCNS = value => {
  const v = String(value || "");
  return v.length === 15 ? `${v.slice(0, 3)}••••••••${v.slice(-4)}` : "Não informado";
};

function inicializarEquipe() {
  if (localStorage.getItem(KEYS.equipe) === null) {
    gravar(KEYS.equipe, [
      { id: "eq-admin", nome: "Ana Admin", email: "admin@sf.com", perfil: "admin", unidade: "", ativo: true,
        senhaHash: "ae3552e6e542fd95edaf78aa539d8ec09f3ff33874143825a65b505aaf226b5b",
        senhaHashFallback: "demo-YWRtaW5Ac2YuY29tOmFkbWluMTIz" },
      { id: "eq-manager", nome: "Marcos Gestor", email: "gestor@sf.com", perfil: "manager", unidade: "UBS Vila Nova", ativo: true,
        senhaHash: "b0788975cdc2aabe3baf7ec6e41673cd51ac79b9b93dc5ca914c51867385515f",
        senhaHashFallback: "demo-Z2VzdG9yQHNmLmNvbTpnZXN0b3IxMjM=" },
      { id: "eq-staff", nome: "Sofia Atendente", email: "atendente@sf.com", perfil: "staff", unidade: "UBS Vila Nova", ativo: true,
        senhaHash: "77448d73bcea69dfb97420d5262bfbc0f78e9a1a5fed4d218dfe93144853cf3e",
        senhaHashFallback: "demo-YXRlbmRlbnRlQHNmLmNvbTphdGVuZDEyMw==" }
    ]);
  }
  if (localStorage.getItem(KEYS.permissoes) === null) gravar(KEYS.permissoes, DEFAULT_PERMS);
  else {
    const atual = ler(KEYS.permissoes, {});
    gravar(KEYS.permissoes, {
      admin: Object.keys(PERMS),
      manager: Array.isArray(atual.manager) ? atual.manager : DEFAULT_PERMS.manager,
      staff: Array.isArray(atual.staff) ? atual.staff : DEFAULT_PERMS.staff
    });
  }
}

function equipeUsuarios() { return ler(KEYS.equipe, []); }
function permissoes() { return ler(KEYS.permissoes, DEFAULT_PERMS); }
function pode(permissao) {
  if (!ME) return false;
  return (permissoes()[ME.perfil] || []).includes(permissao);
}
function registrarAuditoria(acao) {
  const logs = ler(KEYS.auditoria, []);
  logs.unshift({ t: Date.now(), usuario: ME ? ME.nome : "Equipe", acao });
  gravar(KEYS.auditoria, logs.slice(0, 200));
}
function aviso(texto) {
  const el = $("crm-toast");
  el.textContent = texto;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
function aplicarTema() {
  const tema = localStorage.getItem(KEYS.tema);
  if (tema === "dark" || tema === "light") document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
}
function alternarTema() {
  const atual = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const novo = atual === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = novo;
  localStorage.setItem(KEYS.tema, novo);
}

function mostrarLogin() {
  $("crm-login").hidden = false;
  $("crm-dashboard").hidden = true;
  $("crm-email").focus();
}
function mostrarPainel() {
  $("crm-login").hidden = true;
  $("crm-dashboard").hidden = false;
  $("crm-user-name").textContent = ME.nome;
  $("crm-user-role").textContent = ROLES[ME.perfil] || "Equipe";
  $("crm-user-unit").textContent = ME.unidade || "Todas as unidades";
  VIEW = "ag";
  render();
}

async function entrarEquipe(email, senha) {
  email = email.trim().toLowerCase();
  const usuario = equipeUsuarios().find(u => u.email.toLowerCase() === email);
  if (!usuario) return { ok: false, erro: "E-mail ou senha incorretos." };
  if (!usuario.ativo) return { ok: false, erro: "Esta conta está desativada. Procure o administrador." };
  const informado = await SF.hashSenha(email, senha);
  if (usuario.senhaHash !== informado && usuario.senhaHashFallback !== informado) {
    return { ok: false, erro: "E-mail ou senha incorretos." };
  }
  ME = usuario;
  localStorage.setItem(KEYS.sessao, usuario.email);
  registrarAuditoria("Acesso realizado no painel");
  return { ok: true };
}
function sairEquipe() {
  if (ME) registrarAuditoria("Saiu do painel");
  ME = null;
  localStorage.removeItem(KEYS.sessao);
  mostrarLogin();
}

function agendamentosVisiveis() {
  const lista = SF.todosAgendamentos();
  return pode("all.units") ? lista : lista.filter(a => a.unidade === ME.unidade);
}
function pacientesPorEmail() {
  return new Map(SF.todosUsuarios().map(p => [p.email, p]));
}
function nomePaciente(ag, mapa) {
  const p = mapa.get(ag.usuario);
  return p ? p.nome : ag.usuario || "Paciente não identificado";
}

const MENU = [
  ["ag", "Agendamentos", "ag.view"],
  ["pac", "Pacientes", "pac.view"],
  ["users", "Usuários", "users.manage"],
  ["roles", "Permissões", "roles.manage"],
  ["audit", "Auditoria", "audit.view"]
];

function render() {
  const disponiveis = MENU.filter(item => pode(item[2]));
  if (!disponiveis.some(item => item[0] === VIEW)) VIEW = disponiveis[0]?.[0] || "ag";
  $("crm-nav").innerHTML = disponiveis.map(item => `
    <button type="button" class="crm-nav-item ${VIEW === item[0] ? "active" : ""}" data-view="${item[0]}">${item[1]}</button>
  `).join("");
  $("crm-nav").querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => { VIEW = button.dataset.view; render(); });
  });
  if (!disponiveis.length) {
    $("crm-main").innerHTML = '<div class="crm-empty">Seu perfil não possui permissões para visualizar módulos do painel.</div>';
    return;
  }
  const telas = { ag: renderAgendamentos, pac: renderPacientes, users: renderUsuarios, roles: renderPermissoes, audit: renderAuditoria };
  telas[VIEW]();
}

function renderAgendamentos() {
  const unidadeFilter = pode("all.units") ? `
    <select id="crm-unit-filter" aria-label="Filtrar por unidade">
      <option value="">Todas as unidades</option>
      ${UNIDADES.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join("")}
    </select>` : "";
  $("crm-main").innerHTML = `
    <div class="crm-page-title"><div><h1>Agendamentos</h1><p>Os pedidos realizados no site do paciente aparecem nesta área.</p></div></div>
    <div class="crm-toolbar">
      <input id="crm-search" type="search" placeholder="Buscar por paciente, serviço ou código" aria-label="Buscar agendamentos">
      ${unidadeFilter}
    </div>
    <div id="crm-kpis" class="crm-kpis"></div>
    <div id="crm-board" class="crm-board"></div>`;
  $("crm-search").addEventListener("input", atualizarQuadro);
  if ($("crm-unit-filter")) $("crm-unit-filter").addEventListener("change", atualizarQuadro);
  atualizarQuadro();
}

function atualizarQuadro() {
  const busca = ($("crm-search")?.value || "").trim().toLowerCase();
  const unidade = $("crm-unit-filter")?.value || "";
  const mapa = pacientesPorEmail();
  const lista = agendamentosVisiveis().filter(a => {
    const p = mapa.get(a.usuario);
    const texto = [nomePaciente(a, mapa), a.usuario, a.servico, a.codigo, a.unidade].join(" ").toLowerCase();
    return (!unidade || a.unidade === unidade) && (!busca || texto.includes(busca));
  });
  const contagem = status => lista.filter(a => a.status === status).length;
  $("crm-kpis").innerHTML = `
    <div class="crm-kpi"><strong>${contagem("agendado")}</strong><span>Agendados</span></div>
    <div class="crm-kpi"><strong>${contagem("confirmado")}</strong><span>Confirmados</span></div>
    <div class="crm-kpi"><strong>${contagem("atendido")}</strong><span>Atendidos</span></div>
    <div class="crm-kpi"><strong>${lista.length}</strong><span>Total listado</span></div>`;
  $("crm-board").innerHTML = STATUS.map(([status, label]) => {
    const itens = lista.filter(a => (a.status || "agendado") === status)
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    return `<section class="crm-column"><h2>${label}<span class="crm-count">${itens.length}</span></h2>
      ${itens.map(a => cardAgendamento(a, mapa)).join("") || '<p class="crm-muted">Nenhum registro.</p>'}
    </section>`;
  }).join("");
  $("crm-board").querySelectorAll("[data-change-status]").forEach(button => {
    button.addEventListener("click", () => {
      const codigo = button.dataset.code;
      const novoStatus = button.dataset.changeStatus;
      const ag = SF.todosAgendamentos().find(a => a.codigo === codigo);
      if (!ag || !pode("ag.edit")) return;
      if (SF.atualizarStatus(codigo, novoStatus)) {
        registrarAuditoria(`Agendamento ${codigo}: ${rotuloStatus(ag.status)} → ${rotuloStatus(novoStatus)}`);
        aviso("Status do agendamento atualizado.");
        atualizarQuadro();
      }
    });
  });
}

function rotuloStatus(status) { return STATUS.find(s => s[0] === status)?.[1] || status; }

function cardAgendamento(ag, mapa) {
  const status = ag.status || "agendado";
  const nome = nomePaciente(ag, mapa);
  let acoes = "";
  if (pode("ag.edit")) {
    if (status === "agendado") {
      acoes = `<button class="btn crm-btn-small" type="button" data-code="${esc(ag.codigo)}" data-change-status="confirmado">Confirmar</button>
        <button class="btn alt crm-btn-small" type="button" data-code="${esc(ag.codigo)}" data-change-status="cancelado">Cancelar</button>`;
    } else if (status === "confirmado") {
      acoes = `<button class="btn crm-btn-small" type="button" data-code="${esc(ag.codigo)}" data-change-status="atendido">Atendido</button>
        <button class="btn alt crm-btn-small" type="button" data-code="${esc(ag.codigo)}" data-change-status="faltou">Faltou</button>
        <button class="btn alt crm-btn-small" type="button" data-code="${esc(ag.codigo)}" data-change-status="cancelado">Cancelar</button>`;
    }
  }
  return `<article class="crm-appointment">
    <strong>${esc(nome)}</strong>
    <span class="crm-code">${esc(ag.codigo)}</span>
    <p>${esc(ag.servico)}</p>
    <p>${fmtData(ag.data)} · ${esc(ag.hora)}</p>
    ${pode("all.units") ? `<p>${esc(ag.unidade)}</p>` : ""}
    <div class="crm-actions">${acoes}</div>
  </article>`;
}

function renderPacientes() {
  const mapa = pacientesPorEmail();
  const lista = agendamentosVisiveis();
  const resumo = new Map();
  lista.forEach(a => {
    if (!a.usuario) return;
    const paciente = mapa.get(a.usuario);
    if (!paciente) return;
    const item = resumo.get(a.usuario) || { paciente, total: 0, ultimo: "" };
    item.total++;
    if (a.data > item.ultimo) item.ultimo = a.data;
    resumo.set(a.usuario, item);
  });
  const linhas = [...resumo.values()].sort((a, b) => a.paciente.nome.localeCompare(b.paciente.nome));
  $("crm-main").innerHTML = `
    <div class="crm-page-title"><div><h1>Pacientes</h1><p>Pacientes com agendamentos vinculados à sua unidade ou às unidades permitidas.</p></div></div>
    <div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cartão SUS (CNS)</th><th>Telefone</th><th>Agendamentos</th><th>Último</th></tr></thead>
    <tbody>${linhas.map(({ paciente: p, total, ultimo }) => `<tr>
      <td><strong>${esc(p.nome)}</strong></td><td>${esc(p.email)}</td><td>${esc(maskCNS(p.cartao))}</td>
      <td>${esc(p.tel)}</td><td>${total}</td><td>${fmtData(ultimo)}</td>
    </tr>`).join("") || '<tr><td colspan="6">Nenhum paciente com agendamento encontrado.</td></tr>'}</tbody></table></div>
    <p class="crm-note">O CNS é exibido parcialmente mascarado. A visualização é demonstrativa e deve ser substituída por controles de acesso no servidor em uma aplicação real.</p>`;
}

function renderUsuarios() {
  const usuarios = equipeUsuarios();
  $("crm-main").innerHTML = `
    <div class="crm-page-title"><div><h1>Usuários da equipe</h1><p>Gerencie as contas de acesso ao painel administrativo.</p></div>
      <button class="btn" id="crm-add-user" type="button">+ Novo usuário</button></div>
    <div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Unidade</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${usuarios.map(u => `<tr>
      <td><strong>${esc(u.nome)}</strong></td><td>${esc(u.email)}</td><td>${esc(ROLES[u.perfil] || u.perfil)}</td>
      <td>${esc(u.unidade || "Todas")}</td><td><span class="crm-pill ${u.ativo ? "active" : "inactive"}">${u.ativo ? "Ativo" : "Desativado"}</span></td>
      <td><button class="btn alt crm-btn-small" type="button" data-edit-user="${esc(u.id)}">Editar</button>
      ${u.id !== ME.id ? `<button class="btn alt crm-btn-small" type="button" data-toggle-user="${esc(u.id)}">${u.ativo ? "Desativar" : "Ativar"}</button>
      <button class="btn crm-danger crm-btn-small" type="button" data-delete-user="${esc(u.id)}">Excluir</button>` : ""}</td>
    </tr>`).join("")}</tbody></table></div>`;
  $("crm-add-user").addEventListener("click", () => abrirModalUsuario());
  $("crm-main").querySelectorAll("[data-edit-user]").forEach(b => b.addEventListener("click", () => abrirModalUsuario(equipeUsuarios().find(u => u.id === b.dataset.editUser))));
  $("crm-main").querySelectorAll("[data-toggle-user]").forEach(b => b.addEventListener("click", () => alternarUsuario(b.dataset.toggleUser)));
  $("crm-main").querySelectorAll("[data-delete-user]").forEach(b => b.addEventListener("click", () => excluirUsuario(b.dataset.deleteUser)));
}

function abrirModalUsuario(usuario = null) {
  const editando = !!usuario;
  const unidades = [`<option value="">Todas as unidades</option>`, ...UNIDADES.map(u => `<option value="${esc(u)}" ${usuario?.unidade === u ? "selected" : ""}>${esc(u)}</option>`)].join("");
  const perfis = Object.entries(ROLES).map(([id, nome]) => `<option value="${id}" ${usuario?.perfil === id ? "selected" : ""}>${nome}</option>`).join("");
  $("crm-modal-content").innerHTML = `
    <h2>${editando ? "Editar usuário" : "Novo usuário"}</h2>
    <p class="crm-note">${editando ? "Atualize os dados da conta. Deixe a senha em branco para mantê-la." : "Cadastre um novo integrante da equipe."}</p>
    <div class="crm-modal-fields">
      <div class="crm-field full"><label for="crm-user-name-input">Nome completo</label><input id="crm-user-name-input" value="${esc(usuario?.nome || "")}" required></div>
      <div class="crm-field full"><label for="crm-user-email-input">E-mail</label><input id="crm-user-email-input" type="email" value="${esc(usuario?.email || "")}" required></div>
      <div class="crm-field"><label for="crm-user-role-input">Perfil</label><select id="crm-user-role-input">${perfis}</select></div>
      <div class="crm-field"><label for="crm-user-unit-input">Unidade</label><select id="crm-user-unit-input">${unidades}</select></div>
      <div class="crm-field full"><label for="crm-user-pass-input">${editando ? "Nova senha (opcional)" : "Senha (mínimo 6 caracteres)"}</label><input id="crm-user-pass-input" type="password" autocomplete="new-password"></div>
    </div>
    <p id="crm-user-form-error" class="crm-form-error"></p>
    <div class="crm-modal-actions"><button class="btn alt" id="crm-user-cancel" type="button">Cancelar</button><button class="btn" id="crm-user-save" type="button">Salvar</button></div>`;
  const dialog = $("crm-modal");
  if (!dialog.open) dialog.showModal();
  $("crm-user-cancel").onclick = () => dialog.close();
  $("crm-user-save").onclick = async () => {
    const nome = $("crm-user-name-input").value.trim();
    const email = $("crm-user-email-input").value.trim().toLowerCase();
    const perfil = $("crm-user-role-input").value;
    const unidade = $("crm-user-unit-input").value;
    const senha = $("crm-user-pass-input").value;
    const erro = $("crm-user-form-error");
    if (!nome || !/^\S+@\S+\.\S+$/.test(email)) return erro.textContent = "Informe um nome e um e-mail válido.";
    if (equipeUsuarios().some(u => u.email.toLowerCase() === email && u.id !== usuario?.id)) return erro.textContent = "Este e-mail já está cadastrado na equipe.";
    if (!editando && senha.length < 6) return erro.textContent = "A senha deve ter pelo menos 6 caracteres.";
    if (editando && senha && senha.length < 6) return erro.textContent = "A nova senha deve ter pelo menos 6 caracteres.";
    if (editando && email !== usuario.email && !senha) return erro.textContent = "Ao alterar o e-mail, informe também uma nova senha.";
    if (perfil !== "admin" && !unidade) return erro.textContent = "Selecione a unidade do usuário.";
    if (editando && usuario.id === ME.id && perfil !== usuario.perfil) return erro.textContent = "Você não pode alterar seu próprio perfil.";
    if (editando && usuario.id === ME.id && email !== usuario.email) return erro.textContent = "Você não pode alterar seu próprio e-mail por esta tela.";

    const lista = equipeUsuarios();
    if (editando) {
      const alvo = lista.find(u => u.id === usuario.id);
      Object.assign(alvo, { nome, email, perfil, unidade: perfil === "admin" ? "" : unidade });
      if (senha) {
        alvo.senhaHash = await SF.hashSenha(email, senha);
        delete alvo.senhaHashFallback;
      }
      registrarAuditoria(`Usuário atualizado: ${nome}`);
    } else {
      lista.push({
        id: uid(), nome, email, perfil, unidade: perfil === "admin" ? "" : unidade,
        ativo: true, senhaHash: await SF.hashSenha(email, senha)
      });
      registrarAuditoria(`Usuário criado: ${nome}`);
    }
    gravar(KEYS.equipe, lista);
    dialog.close();
    aviso("Usuário salvo.");
    renderUsuarios();
  };
}

function alternarUsuario(id) {
  const lista = equipeUsuarios();
  const alvo = lista.find(u => u.id === id);
  if (!alvo) return;
  if (alvo.perfil === "admin" && alvo.ativo && lista.filter(u => u.perfil === "admin" && u.ativo).length <= 1) {
    return aviso("Mantenha ao menos um administrador ativo.");
  }
  alvo.ativo = !alvo.ativo;
  gravar(KEYS.equipe, lista);
  registrarAuditoria(`${alvo.ativo ? "Conta ativada" : "Conta desativada"}: ${alvo.nome}`);
  renderUsuarios();
}
function excluirUsuario(id) {
  const lista = equipeUsuarios();
  const alvo = lista.find(u => u.id === id);
  if (!alvo || alvo.id === ME.id) return;
  if (alvo.perfil === "admin" && lista.filter(u => u.perfil === "admin" && u.ativo).length <= 1) {
    return aviso("Não é possível excluir o último administrador ativo.");
  }
  if (!confirm(`Excluir o usuário ${alvo.nome}?`)) return;
  gravar(KEYS.equipe, lista.filter(u => u.id !== id));
  registrarAuditoria(`Usuário excluído: ${alvo.nome}`);
  renderUsuarios();
}

function renderPermissoes() {
  const perms = permissoes();
  $("crm-main").innerHTML = `
    <div class="crm-page-title"><div><h1>Permissões por perfil</h1><p>Defina quais módulos podem ser acessados por gestores e atendentes.</p></div></div>
    <p class="crm-note">O perfil Administrador mantém acesso completo. As alterações abaixo afetam os próximos acessos dos usuários.</p>
    <div class="crm-table-wrap"><table class="crm-table crm-permission-table"><thead><tr><th>Permissão</th><th>Administrador</th><th>Gestor</th><th>Atendente</th></tr></thead><tbody>
      ${Object.entries(PERMS).map(([id, label]) => `<tr><td>${label}</td>
        ${["admin", "manager", "staff"].map(role => `<td><input type="checkbox" data-role="${role}" data-permission="${id}" ${perms[role]?.includes(id) ? "checked" : ""} ${role === "admin" ? "disabled" : ""} aria-label="${label} para ${ROLES[role]}"></td>`).join("")}
      </tr>`).join("")}
    </tbody></table></div>`;
  $("crm-main").querySelectorAll("[data-permission]").forEach(input => {
    input.addEventListener("change", () => {
      const atual = permissoes();
      const role = input.dataset.role;
      const permission = input.dataset.permission;
      atual[role] = input.checked
        ? [...new Set([...(atual[role] || []), permission])]
        : (atual[role] || []).filter(p => p !== permission);
      gravar(KEYS.permissoes, atual);
      registrarAuditoria(`Permissão ${PERMS[permission]} ${input.checked ? "concedida a" : "removida de"} ${ROLES[role]}`);
      aviso("Permissões atualizadas.");
    });
  });
}

function renderAuditoria() {
  const logs = ler(KEYS.auditoria, []);
  $("crm-main").innerHTML = `
    <div class="crm-page-title"><div><h1>Auditoria</h1><p>Histórico das ações realizadas no painel.</p></div></div>
    <div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Data e hora</th><th>Usuário</th><th>Ação</th></tr></thead><tbody>
      ${logs.map(item => `<tr><td>${new Date(item.t).toLocaleString("pt-BR")}</td><td>${esc(item.usuario)}</td><td>${esc(item.acao)}</td></tr>`).join("") || '<tr><td colspan="3">Nenhum registro de auditoria.</td></tr>'}
    </tbody></table></div>`;
}

$("crm-login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const botao = event.submitter || $("crm-login-form").querySelector("button[type=submit]");
  botao.disabled = true;
  $("crm-login-error").textContent = "";
  const resultado = await entrarEquipe($("crm-email").value, $("crm-password").value);
  botao.disabled = false;
  if (!resultado.ok) {
    $("crm-login-error").textContent = resultado.erro;
    return;
  }
  $("crm-password").value = "";
  mostrarPainel();
});

$("crm-logout").addEventListener("click", sairEquipe);
$("crm-theme").addEventListener("click", alternarTema);
$("crm-modal-form").addEventListener("submit", event => event.preventDefault());
document.querySelectorAll("[data-demo-email]").forEach(button => {
  button.addEventListener("click", () => {
    $("crm-email").value = button.dataset.demoEmail;
    $("crm-password").value = button.dataset.demoPassword;
    $("crm-password").focus();
  });
});

function iniciar() {
  inicializarEquipe();
  aplicarTema();
  const email = localStorage.getItem(KEYS.sessao);
  ME = equipeUsuarios().find(u => u.email === email && u.ativo) || null;
  if (ME) mostrarPainel();
  else {
    localStorage.removeItem(KEYS.sessao);
    mostrarLogin();
  }
}
iniciar();
