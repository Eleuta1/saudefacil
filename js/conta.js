const $ = id => document.getElementById(id);
const usr = SF.usuario();

// Página protegida: sem login, volta para a tela de entrada
if (!usr) location.replace("login.html?next=minha-conta.html");

function fmtData(iso) { const [a, m, d] = iso.split("-"); return d + "/" + m + "/" + a; }

function card(a, situacao) {
  const rotulo = { proximo: "Agendado", realizado: "Realizado", cancelado: "Cancelado" }[situacao];
  return `
    <article class="ag ${situacao}">
      <div>
        <span class="status ${situacao}">${rotulo}</span>
        <h3>${SF.escapar(a.servico)} — ${SF.escapar(a.unidade)}</h3>
        <p>${fmtData(a.data)} às ${SF.escapar(a.hora)}</p>
        <p>${SF.escapar(a.endereco || "")}</p>
        <p>Código: <strong>${SF.escapar(a.codigo)}</strong></p>
      </div>
      ${situacao === "proximo" ? `<button class="btn alt" data-cancelar="${SF.escapar(a.codigo)}">Cancelar</button>` : ""}
    </article>`;
}

function render() {
  const agora = new Date();
  const prox = [], hist = [];
  SF.agendamentos(usr.email).forEach(a => {
    const futuro = new Date(a.data + "T" + a.hora) >= agora;
    if (a.status === "cancelado") hist.push([a, "cancelado"]);
    else if (futuro) prox.push([a, "proximo"]);
    else hist.push([a, "realizado"]);
  });
  hist.reverse();
  $("proximos").innerHTML = prox.length ? prox.map(x => card(...x)).join("")
    : '<p class="empty">Você não tem agendamentos futuros. <a href="index.html#agendar">Agende agora</a>.</p>';
  $("historico").innerHTML = hist.length ? hist.map(x => card(...x)).join("")
    : '<p class="empty">Nada por aqui ainda.</p>';
}

if (usr) {
  $("ola").textContent = "Olá, " + usr.nome.split(" ")[0] + ".";
  $("perfil").textContent = usr.email + " · Cartão SUS " + usr.cartao;
  render();
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-cancelar]");
    if (b && confirm("Cancelar este agendamento?")) { SF.cancelar(b.dataset.cancelar, usr.email); render(); }
  });
}