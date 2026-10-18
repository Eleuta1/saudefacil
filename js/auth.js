/* =========================================================
   Saúde Fácil — auth.js
   Contas e agendamentos simulados com localStorage.
   ATENÇÃO: é uma simulação para o projeto acadêmico. Em um
   sistema real, login, senhas e agendamentos ficam no SERVIDOR.
   Para trocar depois, basta reescrever as funções de SF.
   ========================================================= */
   const SF = (() => {
    const K = { usuarios: "sf_usuarios", sessao: "sf_sessao", agend: "sf_agendamentos" };
  
    const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
    const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  
    function escapar(txt) {
      const d = document.createElement("div");
      d.textContent = txt ?? "";
      return d.innerHTML;
    }
  
    // Hash da senha (SHA-256 com o e-mail como "sal"). Só funciona em HTTPS/localhost;
    // fora disso usa um fallback simples, apenas para a demonstração funcionar.
    async function hash(email, senha) {
      const txt = email + ":" + senha;
      if (window.crypto && crypto.subtle) {
        const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
      }
      return "demo-" + btoa(unescape(encodeURIComponent(txt)));
    }
  
    async function cadastrar({ nome, email, cartao, tel, senha }) {
      email = email.trim().toLowerCase();
      const usuarios = ler(K.usuarios, []);
      if (usuarios.some(u => u.email === email)) return { ok: false, erro: "Este e-mail já tem cadastro. Use a aba Entrar." };
      usuarios.push({ nome: nome.trim(), email, cartao, tel, senhaHash: await hash(email, senha) });
      gravar(K.usuarios, usuarios);
      localStorage.setItem(K.sessao, email);
      return { ok: true };
    }
  
    async function entrar(email, senha) {
      email = email.trim().toLowerCase();
      const u = ler(K.usuarios, []).find(x => x.email === email);
      if (!u || u.senhaHash !== await hash(email, senha)) return { ok: false, erro: "E-mail ou senha incorretos." };
      localStorage.setItem(K.sessao, email);
      return { ok: true };
    }
  
    function sair() { localStorage.removeItem(K.sessao); }
  
    function usuario() {
      const email = localStorage.getItem(K.sessao);
      return email ? ler(K.usuarios, []).find(u => u.email === email) || null : null;
    }
  
    function agendamentos(email) {
      return ler(K.agend, []).filter(a => a.usuario === email)
        .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    }
  
    function agendar(dados) {
      const lista = ler(K.agend, []);
      const codigo = "SF-" + Math.floor(10000 + Math.random() * 90000);
      lista.push({ ...dados, codigo, status: "agendado", criadoEm: new Date().toISOString() });
      gravar(K.agend, lista);
      return codigo;
    }
  
    function cancelar(codigo, email) {
      const lista = ler(K.agend, []);
      const a = lista.find(x => x.codigo === codigo && x.usuario === email);
      if (a) { a.status = "cancelado"; gravar(K.agend, lista); }
    }
  
    // Ajusta o menu do cabeçalho conforme o login
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
  
    return { escapar, cadastrar, entrar, sair, usuario, agendamentos, agendar, cancelar };
  })();