import { describe, test, expect } from 'vitest'
import { extractFromHTML } from '../extractor'

// Página armada como la de un sitio de apuntes: menú, botones y barra lateral
// alrededor del contenido real (el caso que ensuciaba los fragmentos).
const parrafo = (n: number) =>
  `<p>Las estructuras de control permiten modificar el orden de ejecución de un programa. ` +
  `Este es el párrafo ${n} del apunte, con suficiente texto para que cuente como contenido real ` +
  `y no como un botón o un menú de navegación del sitio.</p>`

const PAGINA = `<!doctype html><html><head><title>Informática | Apuntes</title></head><body>
  <div class="topbar"><a href="/redes">Volver a Redes de Información</a></div>
  <div class="toolbar"><button>Me Sirvió</button><button>Guardar</button><button>Descargar</button>
    <button>Compartir</button><button>Reportar</button></div>
  <div class="layout">
    <main><article>
      <h1>Informática</h1>
      ${[1, 2, 3, 4, 5, 6].map(parrafo).join('\n')}
      <h2>Estructuras de control</h2>
      <ul><li>Condicionales: if y else.</li><li>Bucles: for y while.</li></ul>
    </article></main>
    <div class="sidebar"><a>Más información...</a><span>Sigue al estudiante</span></div>
  </div>
</body></html>`

describe('extracción de páginas web', () => {
  test('se queda con el contenido del artículo', () => {
    const texto = extractFromHTML(PAGINA, 'https://ejemplo.com/apunte')!
    expect(texto).toContain('párrafo 1 del apunte')
    expect(texto).toContain('párrafo 6 del apunte')
    expect(texto).toContain('Bucles: for y while.')
  })

  test('descarta botones, menús y barras laterales del sitio', () => {
    const texto = extractFromHTML(PAGINA, 'https://ejemplo.com/apunte')!
    for (const ruido of ['Me Sirvió', 'Compartir', 'Reportar', 'Volver a Redes', 'Sigue al estudiante']) {
      expect(texto).not.toContain(ruido)
    }
  })

  test('conserva los párrafos separados para que el chunker pueda cortar bien', () => {
    const texto = extractFromHTML(PAGINA, 'https://ejemplo.com/apunte')!
    expect(texto).toMatch(/del sitio\.\n\nLas estructuras/)
  })

  test('si la página no tiene un artículo reconocible, devuelve null', () => {
    expect(extractFromHTML('<html><body><button>Entrar</button></body></html>', 'https://ejemplo.com')).toBeNull()
  })
})
