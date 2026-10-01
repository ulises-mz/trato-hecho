// Genera las fichas en PDF y las capturas del README. Necesita Playwright:
//   npm i playwright && npx playwright install chromium
//   node herramientas/capturas.js
// Sirve la carpeta en http://127.0.0.1:8765 antes (python3 -m http.server 8765).
const { chromium } = require("playwright");
const path = require("path");
const RAIZ = path.resolve(__dirname, "..");
const URL = process.env.URL || "http://127.0.0.1:8765/";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 }, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  for (const lado of ["agencia", "cliente"]) {
    await p.goto(`${URL}fichas.html?lado=${lado}`); await p.waitForTimeout(800);
    await p.pdf({ path: path.join(RAIZ, "fichas", `ficha-${lado}.pdf`), format: "Letter", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "15mm", right: "15mm" } });
  }
  await p.goto(`${URL}fichas.html`); await p.waitForTimeout(800);
  await p.pdf({ path: path.join(RAIZ, "fichas", "fichas-ambos-lados.pdf"), format: "Letter", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "15mm", right: "15mm" } });
  if (process.env.CAPTURAS) {
    const out = process.env.CAPTURAS;
    await p.goto(URL + "#inicio"); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, "inicio.png") });
    await p.fill("#sala", "3"); await p.click('[data-lado="agencia"]'); await p.click("#btn-entrar"); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, "ficha.png"), fullPage: true });
    await p.goto(URL + "#mesa"); await p.waitForTimeout(400);
    for (const [i, l] of ["B", "E", "D", "C", "D"].entries()) await p.check(`input[name="tema-${i}"][value="${l}"]`);
    await p.waitForTimeout(200); await p.screenshot({ path: path.join(out, "mesa.png") });
    await p.click("#btn-cerrar"); await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, "codigo.png") });
    await p.goto(URL + "#resultados"); await p.waitForTimeout(300); await p.click("#btn-ejemplo"); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, "resultados.png"), fullPage: true });
    await p.goto(URL + "#guion"); await p.waitForTimeout(400); await p.screenshot({ path: path.join(out, "guion.png"), fullPage: true });
  }
  await b.close();
  console.log("fichas y capturas listas");
})();
