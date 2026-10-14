/* =========================================================
   Saúde Fácil — script.js
   1. Dados de demonstração
   2. Utilitários
   3. Integração com Google (Maps JS + Places API New)
   4. Localização do usuário
   5. Lista de unidades e filtros
   6. Formulário de agendamento
   ========================================================= */

   const $ = id => document.getElementById(id);

   /* ---------- 1. Dados de demonstração (fictícios) ---------- */
   const unidadesDemo = [
     { id: "1", nome: "UBS Vila Nova",        tipo: "UBS", end: "Rua das Flores, 120 — Vila Nova",      hor: "Seg a sex, 7h–17h" },
     { id: "2", nome: "UBS Centro",           tipo: "UBS", end: "Av. Principal, 450 — Centro",          hor: "Seg a sex, 7h–18h" },
     { id: "3", nome: "UPA Zona Leste",       tipo: "UPA", end: "Av. Leste, 2000 — Jardim Leste",       hor: "24 horas" },
     { id: "4", nome: "UBS Jardim Esperança", tipo: "UBS", end: "Rua Esperança, 33 — Jd. Esperança",    hor: "Seg a sex, 7h–16h" },
     { id: "5", nome: "UPA Zona Sul",         tipo: "UPA", end: "Rua do Sul, 890 — Cidade Sul",         hor: "24 horas" }
   ];
   
   let unidades = [...unidadesDemo];   // lista atual na tela
   let modoGoogle = false;             // true quando os dados vêm do Google
   
   /* ---------- 2. Utilitários ---------- */
   function escapar(txt) {
     const d = document.createElement("div");
     d.textContent = txt ?? "";
     return d.innerHTML;
   }
   
   // Distância em km entre dois pontos (fórmula de Haversine)
   function distanciaKm(a, b) {
     const R = 6371, rad = g => g * Math.PI / 180;
     const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
     const h = Math.sin(dLat / 2) ** 2 +
               Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
     return 2 * R * Math.asin(Math.sqrt(h));
   }
   
   function status(msg, erro = false) {
     const el = $("geo-status");
     el.textContent = msg;
     el.classList.toggle("erro", erro);
   }
   
   /* ---------- 3. Integração com Google ---------- */
   function carregarGoogle() {
     return new Promise((resolve, reject) => {
       if (typeof GOOGLE_API_KEY === "undefined" || !GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith("COLE")) {
         return reject(new Error("sem-chave"));
       }
       if (window.google && google.maps) return resolve();
   
       window.__gmapsPronto = resolve;   // chamado pelo Google quando o script termina
       const s = document.createElement("script");
       s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_API_KEY) +
               "&loading=async&language=pt-BR&region=BR&callback=__gmapsPronto";
       s.onerror = () => reject(new Error("falha-script"));
       document.head.appendChild(s);
     });
   }
   
   async function buscarNoGoogle(pos, raioKm) {
     const { Place } = await google.maps.importLibrary("places");
   
     // Duas buscas: uma para UPAs e outra para postos de saúde
     const consultas = ["UPA pronto atendimento", "UBS posto de saúde"];
     const respostas = await Promise.all(consultas.map(q =>
       Place.searchByText({
         textQuery: q,
         fields: ["id", "displayName", "formattedAddress", "location", "googleMapsURI", "businessStatus"],
         locationBias: { center: pos, radius: raioKm * 1000 },
         maxResultCount: 20,
         language: "pt-BR",
         region: "br"
       })
     ));
   
     const vistos = new Map();
     respostas.flatMap(r => r.places).forEach(p => {
       if (!p.location || vistos.has(p.id)) return;
       const nome = p.displayName || "";
       // Mantém só o que parece unidade pública de saúde
       if (!/UPA|UBS|posto de sa[uú]de|unidade b[aá]sica|pronto.?atendimento|centro de sa[uú]de/i.test(nome)) return;
       const local = { lat: p.location.lat(), lng: p.location.lng() };
       vistos.set(p.id, {
         id: p.id,
         nome,
         tipo: /UPA|pronto/i.test(nome) ? "UPA" : "UBS",
         end: p.formattedAddress || "",
         hor: "",
         mapa: p.googleMapsURI,
         dist: distanciaKm(pos, local)
       });
     });
   
     return [...vistos.values()]
       .filter(u => u.dist <= raioKm)
       .sort((a, b) => a.dist - b.dist);
   }
   
   /* ---------- 4. Localização do usuário ---------- */
   async function usarMinhaLocalizacao() {
     if (!navigator.geolocation) {
       return status("Seu navegador não permite obter a localização.", true);
     }
     status("Obtendo sua localização...");
     $("btn-geo").disabled = true;
   
     navigator.geolocation.getCurrentPosition(async p => {
       const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
       const raio = Number($("f-raio").value);
       try {
         status("Buscando unidades perto de você...");
         await carregarGoogle();
         unidades = await buscarNoGoogle(pos, raio);
         modoGoogle = true;
         status(unidades.length
           ? unidades.length + " unidade(s) em até " + raio + " km."
           : "Nenhuma unidade encontrada em até " + raio + " km. Tente aumentar o raio.");
       } catch (e) {
         modoGoogle = false;
         unidades = [...unidadesDemo];
         status(e.message === "sem-chave"
           ? "Modo demonstração: configure sua chave do Google em js/config.js para buscar unidades reais."
           : "Não foi possível consultar o Google. Verifique a chave e se as APIs estão ativadas.", true);
       }
       $("btn-geo").disabled = false;
       render();
       preencherSelect();
     }, err => {
       $("btn-geo").disabled = false;
       status(err.code === 1
         ? "Permissão negada. Libere a localização no navegador ou filtre pelo nome do bairro."
         : "Não foi possível obter sua localização.", true);
     }, { enableHighAccuracy: true, timeout: 10000 });
   }
   
   /* ---------- 5. Lista de unidades e filtros ---------- */
   function render() {
     const tipo = $("f-tipo").value;
     const q = $("f-busca").value.trim().toLowerCase();
     const r = unidades.filter(u =>
       (!tipo || u.tipo === tipo) && (!q || (u.nome + " " + u.end).toLowerCase().includes(q)));
   
     $("lista").innerHTML = r.length ? r.map(u => `
       <article class="unit">
         <span class="badge ${u.tipo.toLowerCase()}">${u.tipo === "UPA" ? "Pronto atendimento" : "Posto de saúde"}</span>
         <h3>${escapar(u.nome)}</h3>
         <p>${escapar(u.end)}</p>
         ${u.dist != null ? `<p><strong>${u.dist.toFixed(1).replace(".", ",")} km</strong> de você</p>` : ""}
         ${u.hor ? `<p>${escapar(u.hor)}</p>` : ""}
         ${u.mapa ? `<p><a href="${escapar(u.mapa)}" target="_blank" rel="noopener">Ver no Google Maps</a></p>` : ""}
         <a class="btn" href="#agendar" data-id="${escapar(String(u.id))}">Agendar aqui</a>
       </article>`).join("")
       : `<p class="empty">Nenhuma unidade encontrada. Tente outro nome, tipo ou raio.</p>`;
   }
   
   function preencherSelect() {
     $("unidade").innerHTML = '<option value="">Selecione</option>' +
       unidades.map(u => `<option value="${escapar(String(u.id))}">${escapar(u.nome)} (${u.tipo})</option>`).join("");
   }
   
   $("lista").addEventListener("click", e => {
     const a = e.target.closest("a[data-id]");
     if (a) $("unidade").value = a.dataset.id;
   });
   $("f-tipo").addEventListener("change", render);
   $("f-busca").addEventListener("input", render);
   $("btn-geo").addEventListener("click", usarMinhaLocalizacao);
   
   /* ---------- 6. Formulário de agendamento ---------- */
   $("data").min = new Date().toISOString().split("T")[0];
   
   $("form").addEventListener("submit", e => {
     e.preventDefault();
     const out = $("resultado");
     out.hidden = false;
   
     const campos = ["unidade", "servico", "data", "hora", "nome", "cartao", "tel"];
     const vazio = campos.find(c => !$(c).value.trim());
     if (vazio) {
       out.style.borderColor = "var(--warn)";
       out.textContent = "Preencha todos os campos. Falta: " + $(vazio).previousElementSibling.textContent + ".";
       $(vazio).focus();
       return;
     }
     if (!/^\d{15}$/.test($("cartao").value)) {
       out.style.borderColor = "var(--warn)";
       out.textContent = "O Cartão SUS deve ter 15 números.";
       $("cartao").focus();
       return;
     }
   
     const u = unidades.find(x => String(x.id) === $("unidade").value);
     const [a, m, d] = $("data").value.split("-");
     out.style.borderColor = "var(--ok)";
     out.innerHTML = `<strong>Agendamento confirmado, ${escapar($("nome").value.split(" ")[0])}.</strong><br>
       ${escapar($("servico").value)} em ${escapar(u.nome)}, dia ${d}/${m}/${a} às ${escapar($("hora").value)}.<br>
       Código: <strong>SF-${Math.floor(10000 + Math.random() * 90000)}</strong>.
       Leve um documento com foto e o Cartão SUS.`;
     out.scrollIntoView({ behavior: "smooth", block: "nearest" });
     e.target.reset();
   });
   
   /* ---------- Início ---------- */
   render();
   preencherSelect();