/* Datos de EJEMPLO con la misma forma que la hoja Movimientos de la plataforma B.
   Cuando conectes el script real, este archivo ya no se usa. */
(function () {
  function semilla(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const azar = semilla(2026);
  const entre = (a, b) => Math.round(a + azar() * (b - a));
  const MESES = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const HANDLING = ['N1921U', 'N905FJ', 'N64HA', 'CFRJS'];
  const movimientos = [];
  let n = 0;

  function mov(Tipo, Mes, Linea, Mat, TipoMat, TipoGasto, Contraparte, Concepto, Monto) {
    n++;
    const tope = Mes === '2026-11' ? 9 : 28;
    const dia = String(entre(1, tope)).padStart(2, '0');
    movimientos.push({
      IDOrigen: (Tipo === 'Gasto' ? 'FAC-' : 'ING-') + String(n).padStart(4, '0'),
      Tipo: Tipo, Fecha: Mes + '-' + dia, Mes: Mes,
      Contraparte: Contraparte, Concepto: Concepto,
      MontoSinIVA: Monto, TipoGasto: TipoGasto, LineaNegocio: Linea,
      Matricula: Mat, TipoMatricula: TipoMat
    });
  }

  MESES.forEach(function (mes, i) {
    const k = mes === '2026-11' ? 0.25 : 1;
    const m = function (x) { return Math.round(x * k); };
    mov('Ingreso', mes, 'AOC', 'XADGL', 'AOC', '', 'Propietario XADGL', 'Horas de vuelo', m(entre(230000, 300000)));
    mov('Gasto', mes, 'AOC', 'XADGL', 'AOC', 'Fijo', 'Proveedor de servicios', 'Gastos fijos del avión', m(55000));
    mov('Gasto', mes, 'AOC', 'XADGL', 'AOC', 'Variable', 'Proveedor de combustible', 'Combustible', m(entre(80000, 140000)));
    mov('Ingreso', mes, 'AOC', 'XARHL', 'AOC', '', 'Propietario XARHL', 'Horas de vuelo', m(entre(160000, 210000)));
    mov('Gasto', mes, 'AOC', 'XARHL', 'AOC', 'Fijo', 'Proveedor de servicios', 'Gastos fijos del avión', m(48000));
    mov('Gasto', mes, 'AOC', 'XARHL', 'AOC', 'Variable', 'Proveedor de combustible', 'Combustible', m(entre(50000, 100000)));
    if (i >= 4) {
      mov('Ingreso', mes, 'AOC', 'XABZN', 'AOC', '', 'Propietario XABZN', 'Horas de vuelo', m(i === 4 ? 42000 : 60000));
      mov('Gasto', mes, 'AOC', 'XABZN', 'AOC', 'Fijo', 'Proveedor de servicios', 'Gastos fijos del avión', m(30000));
      mov('Gasto', mes, 'AOC', 'XABZN', 'AOC', 'Variable', 'Proveedor de combustible', 'Combustible', m(15000));
    }
    HANDLING.forEach(function (mat) {
      mov('Ingreso', mes, 'Handling', mat, 'Handling', '', 'Cliente de handling', 'Servicio de handling', m(entre(25000, 45000)));
      mov('Gasto', mes, 'Handling', mat, 'Handling', 'Variable', 'Aeropuerto', 'Aterrizaje handling', m(entre(6000, 14000)));
    });
    mov('Ingreso', mes, 'Guarda', 'JET MACH', 'Corporativo', '', 'Cliente de guarda', 'Servicio de guarda', m(entre(55000, 75000)));
    mov('Gasto', mes, 'Guarda', 'JET MACH', 'Corporativo', 'Variable', 'Aeropuerto', 'Aterrizaje personal', m(entre(12000, 20000)));
    mov('Gasto', mes, 'Corporativo', 'JET MACH', 'Corporativo', 'Fijo', 'Proveedor de servicios', 'Gasto corporativo', m(38000));
  });
  mov('Gasto', '2026-11', 'Sin clasificar', '(vacía)', 'Sin clasificar', 'Variable', 'Proveedor', 'Gasto sin matrícula', 1850);
  mov('Gasto', '2026-11', 'Sin clasificar', 'N777ZZ', 'Sin clasificar', 'Variable', 'Proveedor', 'Matrícula fuera del catálogo', 3200);
  mov('Gasto', '2026-10', 'Sin clasificar', 'N777ZZ', 'Sin clasificar', 'Variable', 'Proveedor', 'Matrícula fuera del catálogo', 2400);

  window.DATOS_EJEMPLO = {
    ok: true,
    actualizado: '2026-11-09T12:00:00',
    movimientos: movimientos,
    porCobrar: [
      { Cliente: 'MANNY HANDLING SUPPORT', Folio: 'R2962', Vencimiento: '2026-10-14', MontoSinIVA: 32100 },
      { Cliente: 'MANNY HANDLING SUPPORT', Folio: 'R2999', Vencimiento: '2026-10-27', MontoSinIVA: 34700 },
      { Cliente: 'Cliente de ejemplo', Folio: 'R3015', Vencimiento: '2026-11-20', MontoSinIVA: 48500 }
    ]
  };
})();
