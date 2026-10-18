const $ = id => document.getElementById(id);

// Só aceita destinos internos (evita redirecionar para outros sites)
function destino() {
  const n = new URLSearchParams(location.search).get("next") || "";
  return /^[\w\-./]+(#[\w-]+)?$/.test(n) && !n.startsWith("//") ? n : "minha-conta.html";
}

if (SF.usuario()) location.replace(destino());

function erro(msg) { const m = $("auth-msg"); m.textContent = msg; m.hidden = !msg; }

function mostrarAba(criar) {
  $("form-entrar").hidden = criar;
  $("form-criar").hidden = !criar;
  $("aba-entrar").setAttribute("aria-selected", String(!criar));
  $("aba-criar").setAttribute("aria-selected", String(criar));
  erro("");
}
$("aba-entrar").onclick = () => mostrarAba(false);
$("aba-criar").onclick = () => mostrarAba(true);

$("form-entrar").addEventListener("submit", async e => {
  e.preventDefault();
  if (!$("e-email").value.trim() || !$("e-senha").value) return erro("Informe e-mail e senha.");
  const r = await SF.entrar($("e-email").value, $("e-senha").value);
  r.ok ? location.href = destino() : erro(r.erro);
});

$("form-criar").addEventListener("submit", async e => {
  e.preventDefault();
  const d = {
    nome: $("c-nome").value, email: $("c-email").value, cartao: $("c-cartao").value.trim(),
    tel: $("c-tel").value, senha: $("c-senha").value
  };
  if (!d.nome.trim() || !d.email.trim() || !d.tel.trim()) return erro("Preencha todos os campos.");
  if (!/^\S+@\S+\.\S+$/.test(d.email)) return erro("Digite um e-mail válido.");
  if (!/^\d{15}$/.test(d.cartao)) return erro("O Cartão SUS deve ter 15 números.");
  if (d.senha.length < 6) return erro("A senha precisa ter pelo menos 6 caracteres.");
  if (d.senha !== $("c-senha2").value) return erro("As senhas não são iguais.");
  const r = await SF.cadastrar(d);
  r.ok ? location.href = destino() : erro(r.erro);
});