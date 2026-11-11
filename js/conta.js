const $ = id => document.getElementById(id);
let usr = SF.usuario();

// Página protegida: sem login, volta para a tela de entrada.
if (!usr) location.replace("login.html?next=minha-conta.html");

function fmtData(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d + "/" + m + "/" + a;
}

const ROTULOS = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  faltou: "Faltou",
  cancelado: "Cancelado"
};

function card(a) {
  const status = a.status || "agendado";
  const classe = status === "atendido" ? "realizado" : status === "cancelado" || status === "faltou" ? "cancelado" : "proximo";
  const podeCancelar = ["agendado", "confirmado"].includes(status);
  return `
    <article class="ag ${classe}">
      <div>
        <span class="status ${classe}">${ROTULOS[status] || "Em análise"}</span>
        <h3>${SF.escapar(a.servico)} — ${SF.escapar(a.unidade)}</h3>
        <p>${fmtData(a.data)} às ${SF.escapar(a.hora)}</p>
        <p>${SF.escapar(a.endereco || "")}</p>
        <p>Código: <strong>${SF.escapar(a.codigo)}</strong></p>
      </div>
      ${podeCancelar ? `<button class="btn alt" data-cancelar="${SF.escapar(a.codigo)}">Cancelar</button>` : ""}
    </article>`;
}

function render() {
  const agora = new Date();
  const prox = [], hist = [];
  SF.agendamentos(usr.email).forEach(a => {
    const futuro = new Date(a.data + "T" + a.hora) >= agora;
    if (a.status === "cancelado" || a.status === "atendido" || a.status === "faltou" || !futuro) hist.push(a);
    else prox.push(a);
  });
  hist.reverse();
  $("proximos").innerHTML = prox.length ? prox.map(card).join("")
    : '<p class="empty">Você não tem agendamentos futuros. <a href="index.html#agendar">Agende agora</a>.</p>';
  $("historico").innerHTML = hist.length ? hist.map(card).join("")
    : '<p class="empty">Nada por aqui ainda.</p>';
}

function preencherPerfil() {
  $("ola").textContent = "Olá, " + usr.nome.split(" ")[0] + ".";
  $("perfil").textContent = usr.email + " · Cartão SUS " + usr.cartao;
  $("perfil-nome").value = usr.nome;
  $("perfil-tel").value = usr.tel;
  $("perfil-cartao").value = usr.cartao;
  $("perfil-senha").value = "";
}

if (usr) {
  preencherPerfil();
  render();

  $("btn-editar-perfil").addEventListener("click", () => {
    $("perfil-form").hidden = !$("perfil-form").hidden;
    $("perfil-msg").hidden = true;
  });
  $("btn-cancelar-edicao").addEventListener("click", () => {
    $("perfil-form").hidden = true;
    preencherPerfil();
  });
  $("perfil-form").addEventListener("submit", async event => {
    event.preventDefault();
    const dados = {
      nome: $("perfil-nome").value.trim(),
      tel: $("perfil-tel").value.trim(),
      cartao: $("perfil-cartao").value.replace(/\D/g, ""),
      senha: $("perfil-senha").value
    };
    const msg = $("perfil-msg");
    msg.hidden = false;
    if (!dados.nome || !dados.tel) return msg.textContent = "Informe seu nome e telefone.";
    if (!/^\d{15}$/.test(dados.cartao)) return msg.textContent = "O Cartão SUS deve ter 15 números.";
    if (dados.senha && dados.senha.length < 6) return msg.textContent = "A nova senha precisa ter pelo menos 6 caracteres.";
    const resultado = await SF.atualizarPerfil(usr.email, dados);
    if (!resultado.ok) return msg.textContent = resultado.erro;
    usr = SF.usuario();
    preencherPerfil();
    $("perfil-form").hidden = true;
    alert("Dados atualizados com sucesso.");
  });

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-cancelar]");
    if (b && confirm("Cancelar este agendamento?")) {
      SF.cancelar(b.dataset.cancelar, usr.email);
      render();
    }
  });
}
