/* Finanzas Jet Mach
 *
 * Los datos salen de la hoja "Movimientos" de la plataforma B.
 * - Con CONFIG.URL_DATOS vacío se usan los datos de ejemplo (datos-ejemplo.js).
 * - Con la URL del Apps Script publicada, la página pide la clave, la envía por POST
 *   (nunca en la dirección) y el script responde:
 *   { ok: true, actualizado, movimientos: [...], porCobrar: [...] }
 *   Cada movimiento trae: IDOrigen, Tipo, Fecha, Mes, Contraparte, Concepto,
 *   MontoSinIVA, TipoGasto, LineaNegocio, Matricula, TipoMatricula.
 *   Cada cuenta por cobrar trae: Cliente, Folio, Vencimiento, MontoSinIVA.
 * Ningún dato financiero se guarda en este repositorio.
 */
const CONFIG = {
  URL_DATOS: 'https://script.google.com/macros/s/AKfycbzqkft4Jq71AkOkQM3cNmcGhIRKBY6pZpAeEOvcKjyFgOEkyQiVIR_pMJdMAgfRiMMVww/exec',
};

const MESES = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio',
  '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};
const AVIONES_AOC = ['XADGL', 'XARHL', 'XABZN'];
const LINEAS = ['Guarda', 'Handling', 'AOC', 'Corporativo'];

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const $ = (id) => document.getElementById(id);
const suma = (lista, f) => lista.reduce((total, x) => total + f(x), 0);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esIngreso = (r) => r.Tipo === 'Ingreso';
const esGasto = (r) => r.Tipo === 'Gasto';
const esFijo = (r) => esGasto(r) && r.TipoGasto === 'Fijo';
const clase = (n) => (n >= 0 ? 'positive' : 'negative');
const nombreMes = (clave) => MESES[clave.slice(5, 7)] || clave;

const state = { anio: '', mes: 'todos', linea: 'todas', avion: 'todos', datos: null };

/* ---------- Datos ---------- */

function pedirClave() {
  let clave = '';
  try { clave = sessionStorage.getItem('jm_clave') || ''; } catch (e) { /* sin almacenamiento */ }
  if (!clave) {
    clave = window.prompt('Clave de acceso a Finanzas Jet Mach') || '';
    try { if (clave) sessionStorage.setItem('jm_clave', clave); } catch (e) { /* sin almacenamiento */ }
  }
  return clave;
}

async function cargarDatos() {
  if (!CONFIG.URL_DATOS) return { ...window.DATOS_EJEMPLO, esEjemplo: true };
  const respuesta = await fetch(CONFIG.URL_DATOS, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ accion: 'finanzas', clave: pedirClave() }),
  });
  const json = await respuesta.json();
  if (!json.ok) {
    try { sessionStorage.removeItem('jm_clave'); } catch (e) { /* sin almacenamiento */ }
    throw new Error(json.error || 'Acceso denegado');
  }
  return json;
}

function normalizar(datos) {
  datos.movimientos = (datos.movimientos || []).map((r) => ({
    ...r,
    MontoSinIVA: Number(r.MontoSinIVA) || 0,
    Mes: r.Mes || String(r.Fecha || '').slice(0, 7),
    TipoGasto: r.TipoGasto || '',
    LineaNegocio: r.LineaNegocio || 'Sin clasificar',
    TipoMatricula: r.TipoMatricula || 'Sin clasificar',
  }));
  datos.porCobrar = (datos.porCobrar || []).map((c) => ({ ...c, MontoSinIVA: Number(c.MontoSinIVA) || 0 }));
  return datos;
}

/* ---------- Filtros ---------- */

function filtrar({ ignorarMes = false } = {}) {
  return state.datos.movimientos.filter((r) => {
    if (state.anio !== 'todos' && !r.Mes.startsWith(state.anio)) return false;
    if (!ignorarMes && state.mes !== 'todos' && r.Mes.slice(5, 7) !== state.mes) return false;
    if (state.linea !== 'todas' && r.LineaNegocio !== state.linea) return false;
    if (state.avion !== 'todos' && r.Matricula !== state.avion) return false;
    return true;
  });
}

function armarFiltros() {
  const movs = state.datos.movimientos;
  const anios = [...new Set(movs.map((r) => r.Mes.slice(0, 4)).filter(Boolean))].sort().reverse();
  state.anio = anios[0] || 'todos';
  $('yearFilter').innerHTML = anios.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('') + '<option value="todos">Todos</option>';
  $('monthFilter').innerHTML = '<option value="todos">Todos</option>' +
    Object.keys(MESES).map((m) => `<option value="${m}">${MESES[m]}</option>`).join('');

  const handling = [...new Set(movs.filter((r) => r.TipoMatricula === 'Handling').map((r) => r.Matricula))].sort();
  $('planeFilter').innerHTML = '<option value="todos">Todos</option>' +
    [...AVIONES_AOC, ...handling].map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');

  $('yearFilter').value = state.anio;
  ['yearFilter', 'monthFilter', 'lineFilter', 'planeFilter'].forEach((id) => $(id).addEventListener('change', () => {
    state.anio = $('yearFilter').value;
    state.mes = $('monthFilter').value;
    state.linea = $('lineFilter').value;
    state.avion = $('planeFilter').value;
    dibujar();
  }));
}

/* ---------- Dibujo ---------- */

function dibujarResumen(filas) {
  const ingresos = filas.filter(esIngreso);
  const gastos = filas.filter(esGasto);
  const totalIng = suma(ingresos, (r) => r.MontoSinIVA);
  const totalGas = suma(gastos, (r) => r.MontoSinIVA);
  const fijos = suma(gastos.filter(esFijo), (r) => r.MontoSinIVA);
  const resultado = totalIng - totalGas;

  $('incomeValue').textContent = dinero.format(totalIng);
  $('incomeCount').textContent = ingresos.length;
  $('expenseValue').textContent = dinero.format(totalGas);
  $('expenseCount').textContent = gastos.length;
  $('expenseMeta').textContent = `Fijos ${dinero.format(fijos)}, variables ${dinero.format(totalGas - fijos)}`;
  $('totalIncome').textContent = dinero.format(totalIng);
  $('totalExpenses').textContent = dinero.format(totalGas);
  const marcador = $('summaryMargin');
  marcador.textContent = dinero.format(resultado);
  marcador.className = clase(resultado);
  $('marginMeta').textContent = totalIng > 0 ? `${(resultado / totalIng * 100).toFixed(1)} %` : '—';
}

function listaPorLinea(idContenedor, filas) {
  const lineas = [...LINEAS];
  if (filas.some((r) => r.LineaNegocio === 'Sin clasificar')) lineas.push('Sin clasificar');
  const datos = lineas.map((linea) => ({ etiqueta: linea, valor: suma(filas.filter((r) => r.LineaNegocio === linea), (r) => r.MontoSinIVA) }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const total = suma(datos, (d) => d.valor);
  $(idContenedor).innerHTML = datos.length
    ? datos.map((d) => `
        <div class="category-item">
          <div class="category-top"><span>${esc(d.etiqueta)}</span><strong>${dinero.format(d.valor)}</strong></div>
          <div class="progress"><span style="width:${total ? d.valor / total * 100 : 0}%"></span></div>
        </div>`).join('')
    : '<p class="vacio-mensaje">No hay movimientos con estos filtros.</p>';
}

function dibujarBarras(idContenedor, valores, etiquetas, alt) {
  const contenedor = $(idContenedor);
  if (!valores.length) { contenedor.innerHTML = '<p class="vacio-mensaje">No hay movimientos con estos filtros.</p>'; return; }
  const maximo = Math.max(...valores, 1);
  contenedor.innerHTML = `<div class="chart-bar-group">${valores.map((v, i) => `
      <div class="chart-bar-col ${alt ? 'alt' : ''}" data-label="${esc(etiquetas[i])}" data-value="${v > 0 ? '$' + Math.round(v / 1000) + ' mil' : ''}"
           style="height:${Math.max(v / maximo * 100, 4)}%" title="${esc(etiquetas[i])}: ${dinero.format(v)}"></div>`).join('')}</div>`;
}

function dibujarMeses(filasTodosMeses) {
  const claves = [...new Set(filasTodosMeses.map((r) => r.Mes))].sort();
  const porMes = claves.map((mes) => {
    const rs = filasTodosMeses.filter((r) => r.Mes === mes);
    const ing = suma(rs.filter(esIngreso), (r) => r.MontoSinIVA);
    const fij = suma(rs.filter(esFijo), (r) => r.MontoSinIVA);
    const gas = suma(rs.filter(esGasto), (r) => r.MontoSinIVA);
    return { mes, ing, fij, var: gas - fij, gas };
  });
  const etiquetas = porMes.map((m) => nombreMes(m.mes).slice(0, 3));
  dibujarBarras('incomeChart', porMes.map((m) => m.ing), etiquetas, false);
  dibujarBarras('expenseChart', porMes.map((m) => m.gas), etiquetas, true);

  const visibles = state.mes === 'todos' ? porMes : porMes.filter((m) => m.mes.slice(5, 7) === state.mes);
  $('monthlyTable').innerHTML = visibles.length ? visibles.map((m) => {
    const res = m.ing - m.gas;
    return `<tr><td>${nombreMes(m.mes)}</td><td class="num">${dinero.format(m.ing)}</td><td class="num">${dinero.format(m.fij)}</td>
      <td class="num">${dinero.format(m.var)}</td><td class="num ${clase(res)}">${dinero.format(res)}</td>
      <td class="num ${clase(res)}">${m.ing > 0 ? (res / m.ing * 100).toFixed(1) + ' %' : '—'}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="vacio-mensaje">No hay movimientos con estos filtros.</td></tr>';
}

function celda(n) { return n === 0 ? '<span class="vacio">—</span>' : dinero.format(n); }

function dibujarAviones(filas) {
  const grupos = AVIONES_AOC.map((m) => ({ nombre: m, f: (r) => r.Matricula === m }));
  grupos.push({ nombre: 'Aviones de Handling', f: (r) => r.TipoMatricula === 'Handling' });
  grupos.push({ nombre: 'Corporativo', f: (r) => r.TipoMatricula === 'Corporativo' });
  if (filas.some((r) => r.TipoMatricula === 'Sin clasificar')) grupos.push({ nombre: 'Sin clasificar', f: (r) => r.TipoMatricula === 'Sin clasificar' });

  let tI = 0, tF = 0, tV = 0;
  $('planeTable').innerHTML = grupos.map((g) => {
    const rs = filas.filter(g.f);
    const ing = suma(rs.filter(esIngreso), (r) => r.MontoSinIVA);
    const fij = suma(rs.filter(esFijo), (r) => r.MontoSinIVA);
    const vari = suma(rs.filter(esGasto), (r) => r.MontoSinIVA) - fij;
    tI += ing; tF += fij; tV += vari;
    const res = ing - fij - vari;
    const hay = ing || fij || vari;
    return `<tr><td>${esc(g.nombre)}</td><td class="num">${celda(ing)}</td><td class="num">${celda(fij)}</td><td class="num">${celda(vari)}</td>
      <td class="num ${hay ? clase(res) : ''}">${hay ? dinero.format(res) : '<span class="vacio">—</span>'}</td></tr>`;
  }).join('');
  const rt = tI - tF - tV;
  $('planeTotal').innerHTML = `<tr><td>Total</td><td class="num">${dinero.format(tI)}</td><td class="num">${dinero.format(tF)}</td><td class="num">${dinero.format(tV)}</td><td class="num ${clase(rt)}">${dinero.format(rt)}</td></tr>`;
}

function dibujarMovimientos(filas) {
  const ordenadas = [...filas].sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
  const mostradas = ordenadas.slice(0, 150);
  $('movementTable').innerHTML = mostradas.length ? mostradas.map((r) => `
    <tr><td>${esc(r.Fecha)}</td><td>${esc(r.Tipo)}</td><td>${esc(r.LineaNegocio)}</td><td>${esc(r.Matricula)}</td>
    <td>${esc(r.Contraparte)}</td><td>${esc(r.Concepto)}</td>
    <td class="num ${esIngreso(r) ? 'positive' : ''}">${dinero.format(r.MontoSinIVA)}</td></tr>`).join('')
    : '<tr><td colspan="7" class="vacio-mensaje">No hay movimientos con estos filtros.</td></tr>';
  $('movementNote').textContent = ordenadas.length > mostradas.length
    ? `Se muestran los ${mostradas.length} más recientes de ${ordenadas.length}.`
    : `${ordenadas.length} movimientos.`;
}

function dibujarPorCobrar() {
  const hoy = new Date();
  const lista = [...state.datos.porCobrar].sort((a, b) => String(a.Vencimiento).localeCompare(String(b.Vencimiento)));
  $('receivableTable').innerHTML = lista.length ? lista.map((c) => {
    const dias = Math.floor((hoy - new Date(String(c.Vencimiento) + 'T23:59:59')) / 86400000);
    const estado = dias > 0
      ? `<span class="estado-vencida">Vencida hace ${dias} ${dias === 1 ? 'día' : 'días'}</span>`
      : `Vence en ${-dias} ${-dias === 1 ? 'día' : 'días'}`;
    return `<tr><td>${esc(c.Cliente)}</td><td>${esc(c.Folio)}</td><td>${esc(c.Vencimiento)}</td><td>${estado}</td><td class="num">${dinero.format(c.MontoSinIVA)}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="vacio-mensaje">No hay facturas por cobrar.</td></tr>';
  $('receivableTotal').innerHTML = `<tr><td colspan="4">Total por cobrar</td><td class="num">${dinero.format(suma(lista, (c) => c.MontoSinIVA))}</td></tr>`;
}

function dibujarCalidad() {
  const n = state.datos.movimientos.filter((r) => r.TipoMatricula === 'Sin clasificar' || r.LineaNegocio === 'Sin clasificar').length;
  $('qualityNote').textContent = n
    ? `${n} movimientos sin clasificar. Corrígelos en la plataforma de facturas para que cuenten en su línea y su avión.`
    : 'Todos los movimientos están clasificados.';
}

function dibujar() {
  const filas = filtrar();
  dibujarResumen(filas);
  listaPorLinea('incomeLines', filas.filter(esIngreso));
  listaPorLinea('expenseLines', filas.filter(esGasto));
  dibujarMeses(filtrar({ ignorarMes: true }));
  dibujarAviones(filas);
  dibujarMovimientos(filas);
}

function activarPestanas() {
  document.querySelectorAll('.tab').forEach((boton) => boton.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === boton));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === boton.dataset.tab));
  }));
}

async function iniciar() {
  activarPestanas();
  try {
    state.datos = normalizar(await cargarDatos());
  } catch (error) {
    $('statusText').textContent = `No se pudieron cargar los datos: ${error.message}`;
    return;
  }
  const cuando = state.datos.actualizado ? new Date(state.datos.actualizado).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '';
  $('statusText').textContent = state.datos.esEjemplo
    ? 'Datos de ejemplo: las cifras no son reales'
    : `Última actualización: ${cuando}`;
  armarFiltros();
  dibujarPorCobrar();
  dibujarCalidad();
  dibujar();
}

iniciar();
