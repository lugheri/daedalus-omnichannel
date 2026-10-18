/**
 * O que vai para o bucket além do HTML das variantes (ADR 0014). Tudo
 * estático: o nginx dos sites não sabe de teste A/B.
 *
 * - Sem teste: `<pasta>/<path>/index.html` é a própria variante.
 * - Com teste: `<pasta>/<path>/index.html` sorteia a variante pelos pesos
 *   (uma vez por navegador, guardada no localStorage) e leva para
 *   `/<path>/<letra>/`, mantendo `?utm_…` e `#`. Sem JavaScript, vai para a
 *   primeira.
 * - Variante que saiu do teste vira um redirecionamento para `/<path>/`
 *   (links compartilhados continuam funcionando).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Caminho e letras já são validados (só [a-z0-9-]); o JSON vai seguro dentro do `<script>`. */
export function splitPage(input: {
  pageId: string;
  path: string;
  title: string;
  variants: { code: string; weight: number }[];
}): string {
  const choices = JSON.stringify(input.variants.map((v) => [v.code, v.weight]));
  const base = `/${input.path}/`;
  const first = input.variants[0].code;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<script>
(function () {
  var choices = ${choices}, key = "omniLp:${input.pageId}", code = null, i;
  try { code = localStorage.getItem(key); } catch (e) {}
  var known = false;
  for (i = 0; i < choices.length; i++) if (choices[i][0] === code) known = true;
  if (!known) {
    var total = 0, roll;
    for (i = 0; i < choices.length; i++) total += choices[i][1];
    roll = Math.random() * total;
    code = choices[0][0];
    for (i = 0; i < choices.length; i++) {
      roll -= choices[i][1];
      if (roll < 0) { code = choices[i][0]; break; }
    }
    try { localStorage.setItem(key, code); } catch (e) {}
  }
  location.replace("${base}" + code + "/" + location.search + location.hash);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${base}${first}/"></noscript>
</head>
<body></body>
</html>
`;
}

/** No lugar de uma variante que saiu do teste: volta para a página. */
export function retiredVariantPage(path: string): string {
  const base = `/${path}/`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${base}">
<script>location.replace("${base}" + location.search + location.hash);</script>
</head>
<body><a href="${base}">Continuar</a></body>
</html>
`;
}

/**
 * Avisa a visita: uma vez por navegador, variante e dia (localStorage), num
 * POST sem corpo e sem CORS (`no-cors`). Nada de cookie nem dado pessoal.
 */
export function viewBeaconScript(variantId: string, url: string): string {
  return `<script>
(function () {
  var key = "omniLpView:${variantId}", day = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(key) === day) return; localStorage.setItem(key, day); } catch (e) {}
  try { fetch(${JSON.stringify(url)}, { method: "POST", mode: "no-cors", keepalive: true }); } catch (e) {}
})();
</script>`;
}
