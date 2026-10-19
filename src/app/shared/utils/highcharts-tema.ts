import * as Highcharts from 'highcharts';

/** True cuando la aplicacion esta en tema oscuro (<html data-theme="dark">). */
const esOscuro = (): boolean => document.documentElement.getAttribute('data-theme') === 'dark';

/** Color de las lineas que separan porciones del grafico (sectores de torta, barras). */
export const colorSeparadorGrafico = (): string => (esOscuro() ? '#0f1626' : '#ffffff');

/** Color de fondo de las capturas (imagen del reporte): el mismo fondo de pagina que se ve en pantalla. */
export const colorFondoCaptura = (): string => (esOscuro() ? '#0a101d' : '#f5f7fa');

/** Color de las lineas de cuadricula de los ejes. */
export const colorGrillaGrafico = (): string => (esOscuro() ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb');

/**
 * Ajusta los colores base de TODOS los graficos de Highcharts segun el tema (fondo, textos, ejes, leyenda).
 * Se llama justo antes de dibujar los graficos; lo que cada reporte define por su cuenta (colores de series, etc.) tiene prioridad.
 * Los valores del tema claro son los que Highcharts ya trae por defecto.
 */
export function aplicarTemaGraficos(oscuro: boolean): void {
  const c = oscuro
    ? { fondo: 'transparent', titulo: '#e6ebf5', texto: '#c3cee0', linea: 'rgba(255,255,255,0.22)', grilla: 'rgba(255,255,255,0.1)', borde: '#0f1626', hover: '#ffffff', oculto: '#64748b' }
    : { fondo: '#ffffff', titulo: '#333333', texto: '#666666', linea: '#ccd6eb', grilla: '#e6e6e6', borde: '#ffffff', hover: '#000000', oculto: '#cccccc' };

  const eje = {
    labels: { style: { color: c.texto } },
    title: { style: { color: c.texto } },
    lineColor: c.linea,
    tickColor: c.linea,
    gridLineColor: c.grilla,
  };

  Highcharts.setOptions({
    chart: { backgroundColor: c.fondo },
    title: { style: { color: c.titulo } },
    subtitle: { style: { color: c.texto } },
    xAxis: eje,
    yAxis: eje,
    legend: {
      itemStyle: { color: c.titulo },
      itemHoverStyle: { color: c.hover },
      itemHiddenStyle: { color: c.oculto },
    },
    plotOptions: {
      series: { dataLabels: { style: { color: c.titulo } } },
      pie: { borderColor: c.borde },
      column: { borderColor: c.borde },
    },
  });
}
