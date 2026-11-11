/* =========================================================
   Saúde Fácil — auth.js
   Autenticação e dados de demonstração no navegador.
   ATENÇÃO: esta implementação é acadêmica. Em produção,
   autenticação, autorização e dados de saúde devem ficar em
   um backend seguro, nunca apenas no localStorage.
   ========================================================= */
const SF = (() => {
  const K = {
    usuarios: "sf_usuarios",
    sessao: "sf_sessao",
    agend: "sf_agendamentos",
    auditoria: "sf_equipe_auditoria"
  };

  const ler = (k, padrao) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? padrao; }
    catch { return padrao; }
  };
  const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function registrarAuditoria(usuario, acao) {
    const logs = ler(K.auditoria, []);
    logs.unshift({ t: Date.now(), usuario: usuario || "Paciente", acao });
    gravar(K.auditoria, logs.slice(0, 200));
  }

  function escapar(txt) {
    const d = document.createElement("div");
    d.textContent = txt ?? "";
    return d.innerHTML;
  }

  async function hash(email, senha) {
    const txt = email + ":" + senha;
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
    }
    return "demo-" + btoa(unescape(encodeURIComponent(txt)));
  }

  // Dados fictícios inseridos somente na primeira execução, sem sobrescrever dados existentes.
  function inicializarDemo() {
    if (localStorage.getItem(K.usuarios) !== null || localStorage.getItem(K.agend) !== null) return;
    const data = dias => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const dia = String(d.getDate()).padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    };
    gravar(K.usuarios, [{
      nome: "Carlos Lima",
      email: "paciente@sf.com",
      cartao: "123456789012345",
      tel: "(11) 99999-1111",
      senhaHash: "85ca5a6b360b8fcca0387a4ae8f49fdc70060aa1aed0a4a0f9d93a77844e22e2",
      senhaHashFallback: "demo-cGFjaWVudGVAc2YuY29tOnBhY2llbnRlMTIz"
    }]);
    gravar(K.agend, [
      { usuario: "paciente@sf.com", unidadeId: "1", unidade: "UBS Vila Nova", endereco: "Rua das Flores, 120 — Vila Nova", servico: "Clínica geral", data: data(1), hora: "09:30", codigo: "SF-48213", status: "confirmado", criadoEm: new Date().toISOString() },
      { usuario: "paciente@sf.com", unidadeId: "1", unidade: "UBS Vila Nova", endereco: "Rua das Flores, 120 — Vila Nova", servico: "Pediatria", data: data(2), hora: "08:00", codigo: "SF-51002", status: "agendado", criadoEm: new Date().toISOString() },
      { usuario: "paciente@sf.com", unidadeId: "2", unidade: "UBS Centro", endereco: "Av. Principal, 450 — Centro", servico: "Odontologia", data: data(1), hora: "14:00", codigo: "SF-33871", status: "agendado", criadoEm: new Date().toISOString() },
      { usuario: "paciente@sf.com", unidadeId: "5", unidade: "UPA Zona Sul", endereco: "Rua do Sul, 890 — Cidade Sul", servico: "Exames de Imagem", data: data(-1), hora: "10:00", codigo: "SF-20455", status: "atendido", criadoEm: new Date().toISOString() }
    ]);
  }
  inicializarDemo();

  async function cadastrar({ nome, email, cartao, tel, senha }) {
    email = email.trim().toLowerCase();
    const usuarios = ler(K.usuarios, []);
    if (usuarios.some(u => u.email === email)) {
      return { ok: false, erro: "Este e-mail já tem cadastro. Use a aba Entrar." };
    }
    if (usuarios.some(u => u.cartao === cartao)) {
      return { ok: false, erro: "Já existe uma conta com este Cartão SUS." };
    }
    usuarios.push({ nome: nome.trim(), email, cartao, tel, senhaHash: await hash(email, senha) });
    gravar(K.usuarios, usuarios);
    localStorage.setItem(K.sessao, email);
    registrarAuditoria(nome.trim(), "Nova conta de paciente criada");
    return { ok: true };
  }

  async function entrar(email, senha) {
    email = email.trim().toLowerCase();
    const u = ler(K.usuarios, []).find(x => x.email === email);
    const senhaInformada = await hash(email, senha);
    if (!u || (u.senhaHash !== senhaInformada && u.senhaHashFallback !== senhaInformada)) {
      return { ok: false, erro: "E-mail ou senha incorretos." };
    }
    localStorage.setItem(K.sessao, email);
    registrarAuditoria(u.nome, "Login do paciente");
    return { ok: true };
  }

  function sair() {
    const atual = usuario();
    if (atual) registrarAuditoria(atual.nome, "Logout do paciente");
    localStorage.removeItem(K.sessao);
  }

  function usuario() {
    const email = localStorage.getItem(K.sessao);
    return email ? ler(K.usuarios, []).find(u => u.email === email) || null : null;
  }

  function todosUsuarios() { return ler(K.usuarios, []); }

  function todosAgendamentos() {
    return ler(K.agend, []).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  }

  function agendamentos(email) {
    return todosAgendamentos().filter(a => a.usuario === email);
  }

  function agendar(dados) {
    const lista = ler(K.agend, []);
    const codigo = "SF-" + Math.floor(10000 + Math.random() * 90000);
    lista.push({ ...dados, codigo, status: "agendado", criadoEm: new Date().toISOString() });
    gravar(K.agend, lista);
    const paciente = ler(K.usuarios, []).find(u => u.email === dados.usuario);
    registrarAuditoria(paciente?.nome || dados.usuario, `Novo agendamento ${codigo}`);
    return codigo;
  }

  function atualizarStatus(codigo, status) {
    const permitidos = ["agendado", "confirmado", "atendido", "faltou", "cancelado"];
    if (!permitidos.includes(status)) return false;
    const lista = ler(K.agend, []);
    const ag = lista.find(a => a.codigo === codigo);
    if (!ag) return false;
    ag.status = status;
    ag.atualizadoEm = new Date().toISOString();
    gravar(K.agend, lista);
    return true;
  }

  function cancelar(codigo, email) {
    const lista = ler(K.agend, []);
    const a = lista.find(x => x.codigo === codigo && x.usuario === email);
    if (a && ["agendado", "confirmado"].includes(a.status)) {
      a.status = "cancelado";
      a.atualizadoEm = new Date().toISOString();
      gravar(K.agend, lista);
      const paciente = ler(K.usuarios, []).find(u => u.email === email);
      registrarAuditoria(paciente?.nome || email, `Agendamento ${codigo} cancelado pelo paciente`);
    }
  }

  async function atualizarPerfil(email, dados) {
    const usuarios = ler(K.usuarios, []);
    const usuario = usuarios.find(u => u.email === email);
    if (!usuario) return { ok: false, erro: "Conta não encontrada." };
    if (usuarios.some(u => u.email !== email && u.cartao === dados.cartao)) {
      return { ok: false, erro: "Já existe uma conta com este Cartão SUS." };
    }
    usuario.nome = dados.nome.trim();
    usuario.cartao = dados.cartao;
    usuario.tel = dados.tel.trim();
    if (dados.senha) {
      usuario.senhaHash = await hash(email, dados.senha);
      delete usuario.senhaHashFallback;
    }
    gravar(K.usuarios, usuarios);
    registrarAuditoria(usuario.nome, "Perfil do paciente atualizado");
    return { ok: true };
  }

  function atualizarMenu() {
    const conta = document.getElementById("nav-conta");
    const sairLink = document.getElementById("nav-sair");
    if (!conta) return;
    const u = usuario();
    conta.textContent = u ? "Minha conta" : "Entrar";
    if (sairLink) {
      sairLink.hidden = !u;
      sairLink.onclick = e => { e.preventDefault(); sair(); location.href = "index.html"; };
    }
  }
  document.addEventListener("DOMContentLoaded", atualizarMenu);

  return {
    escapar, hashSenha: hash, cadastrar, entrar, sair, usuario,
    todosUsuarios, todosAgendamentos, agendamentos, agendar,
    atualizarStatus, cancelar, atualizarPerfil
  };
})();
