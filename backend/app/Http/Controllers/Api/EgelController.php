<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pregunta;
use App\Models\Recurso;
use App\Services\ContenidoLoader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class EgelController extends Controller
{
    public function temario(): JsonResponse
    {
        $temario = ContenidoLoader::getTemario();
        if (!$temario) {
            return response()->json(['message' => 'Temario no encontrado.'], 404);
        }
        return response()->json(['temario' => $temario]);
    }

    public function preguntas(Request $request): JsonResponse
    {
        // Si la tabla aún está vacía, importamos automáticamente desde ../contenido
        if (Pregunta::count() === 0) {
            ContenidoLoader::importarTodoABaseDeDatos();
        }

        $preset = $request->query('preset');

        // Simulacro con la distribución de la guía. El banco reto es práctica adicional.
        if (in_array($preset, ['egel_completo', 'practica_rapida'], true)) {
            $temario = ContenidoLoader::getTemario();
            $todas = Pregunta::where('banco', '!=', 'reto')->get()->groupBy('subarea');
            $seleccion = collect();

            foreach ($temario['secciones'] ?? [] as $sec) {
                foreach ($sec['areas'] ?? [] as $area) {
                    foreach ($area['subareas'] ?? [] as $sub) {
                        $pool = ($todas->get($sub['id']) ?? collect())->shuffle();
                        $tomar = (int) ($sub['reactivos'] ?? 0);
                        if ($pool->count() < $tomar) {
                            return response()->json([
                                'message' => "Faltan reactivos para la subárea {$sub['id']}: {$pool->count()} de {$tomar}.",
                            ], 422);
                        }
                        $seleccion = $seleccion->concat($pool->take($tomar));
                    }
                }
            }

            if ($preset === 'practica_rapida') {
                $cupos = ['A1' => 3, 'A2' => 3, 'A3' => 5, 'A4' => 3, 'L1' => 3, 'L2' => 3];
                $porArea = $seleccion->groupBy('area');
                $seleccion = collect();
                foreach ($cupos as $areaId => $cupo) {
                    $seleccion = $seleccion->concat(($porArea->get($areaId) ?? collect())->shuffle()->take($cupo));
                }
            }

            $lista = $seleccion->values();
            if ($request->boolean('ocultar_respuestas')) {
                $lista = $lista->map(fn (Pregunta $p) => self::ocultarRespuestas($p))->values();
            }

            return response()->json([
                'preguntas' => $lista,
                'total' => $lista->count(),
            ]);
        }

        $query = Pregunta::query();

        if ($ids = $request->query('ids')) {
            $idList = array_filter(explode(',', $ids));
            $query->whereIn('id', $idList);
        } else {
            if ($area = $request->query('area')) {
                $query->where('area', $area);
            }
            if ($subarea = $request->query('subarea')) {
                $query->where('subarea', $subarea);
            }
            if ($banco = $request->query('banco')) {
                $query->where('banco', $banco);
            }
        }

        $orden = $request->query('orden', 'modular');
        $preguntas = $query->inRandomOrder()->get();

        $limit = (int) $request->query('limit', 0);
        if ($limit > 0) {
            $preguntas = $preguntas->take($limit)->values();
        }

        if ($orden === 'modular') {
            $areaOrder = ['A1' => 1, 'A2' => 2, 'A3' => 3, 'A4' => 4, 'L1' => 5, 'L2' => 6];
            $preguntas = $preguntas->sortBy(function (Pregunta $p) use ($areaOrder) {
                $aRank = $areaOrder[$p->area] ?? 99;
                return sprintf('%02d-%s', $aRank, $p->subarea);
            })->values();
        }

        $lista = $preguntas->values();
        if ($request->boolean('ocultar_respuestas')) {
            $lista = $lista->map(fn (Pregunta $p) => self::ocultarRespuestas($p))->values();
        }

        return response()->json([
            'preguntas' => $lista,
            'total' => $lista->count(),
        ]);
    }

    public static function ocultarRespuestas(Pregunta $p): array
    {
        $data = $p->toArray();
        unset($data['correcta'], $data['estrategia'], $data['trampa']);
        $data['opciones'] = array_map(
            fn ($o) => ['texto' => $o['texto'] ?? '', 'explicacion' => ''],
            $data['opciones'] ?? []
        );
        return $data;
    }

    public function biblioteca(Request $request): JsonResponse
    {
        $recursos = Cache::remember('egel_recursos_v1', 3600, function () {
            if (Recurso::count() === 0) {
                ContenidoLoader::importarTodoABaseDeDatos();
            }

            return Recurso::orderByRaw('COALESCE(prioridad, 99) ASC')
                ->orderBy('titulo')
                ->get();
        });

        $area = $request->query('area');
        $tipo = $request->query('tipo');
        $idioma = $request->query('idioma');
        $q = mb_strtolower(trim((string) $request->query('q', '')));
        $soloArchivo = $request->boolean('solo_archivo');
        $soloOficial = $request->boolean('solo_oficial');
        $soloGratuito = $request->boolean('solo_gratuito');
        $orden = $request->query('orden', 'prioridad');

        $filtrados = $recursos->filter(function (Recurso $r) use ($area, $tipo, $idioma, $q, $soloArchivo, $soloOficial, $soloGratuito) {
            if ($area && !in_array($area, $r->areas ?? [], true)) {
                return false;
            }
            if ($tipo && $r->tipo !== $tipo) {
                return false;
            }
            if ($idioma && ($r->idioma ?? '') !== $idioma) {
                return false;
            }
            if ($soloArchivo && empty($r->archivo)) {
                return false;
            }
            if ($soloOficial && !$r->oficial) {
                return false;
            }
            if ($soloGratuito && !$r->gratuito) {
                return false;
            }
            if ($q !== '') {
                $haystack = mb_strtolower(
                    ($r->titulo ?? '') . ' ' . ($r->autores ?? '') . ' ' . ($r->nota ?? '') . ' ' . implode(' ', $r->subareas ?? [])
                );
                if (!str_contains($haystack, $q)) {
                    return false;
                }
            }
            return true;
        })->values();

        if ($orden === 'anio_desc') {
            $filtrados = $filtrados->sortByDesc(fn (Recurso $r) => $r->anio ?? 0)->values();
        } elseif ($orden === 'titulo') {
            $filtrados = $filtrados->sortBy(fn (Recurso $r) => mb_strtolower($r->titulo ?? ''))->values();
        }

        $porTipo = $recursos->groupBy('tipo')->map->count();

        return response()->json([
            'recursos' => $filtrados,
            'total' => $filtrados->count(),
            'resumen' => [
                'total_catalogo' => $recursos->count(),
                'con_archivo' => $recursos->filter(fn (Recurso $r) => !empty($r->archivo))->count(),
                'oficiales' => $recursos->where('oficial', true)->count(),
                'gratuitos' => $recursos->where('gratuito', true)->count(),
                'por_tipo' => $porTipo,
            ],
        ]);
    }

    public function guias(): JsonResponse
    {
        return response()->json([
            'guias' => ContenidoLoader::getGuias(),
        ]);
    }

    public function comandos(): JsonResponse
    {
        return response()->json([
            'ramas' => ContenidoLoader::getComandos(),
        ]);
    }

    public function buscar(Request $request): JsonResponse
    {
        $q = mb_strtolower(trim((string) $request->query('q', '')));
        $tipoFiltro = $request->query('tipo', 'todos');
        if (mb_strlen($q) < 2) {
            return response()->json([
                'guias' => [],
                'comandos' => [],
                'preguntas' => [],
                'recursos' => [],
                'total' => 0,
            ]);
        }

        if (Pregunta::count() === 0 || Recurso::count() === 0) {
            ContenidoLoader::importarTodoABaseDeDatos();
        }

        $guias = [];
        if ($tipoFiltro === 'todos' || $tipoFiltro === 'guias') {
            $guias = collect(ContenidoLoader::getGuias())
                ->filter(fn ($g) => str_contains(mb_strtolower($g['clave'] . ' ' . $g['titulo'] . ' ' . $g['contenido']), $q))
                ->take(8)
                ->map(function ($g) use ($q) {
                    $plain = preg_replace('/[#*`>_]+/', ' ', $g['contenido']);
                    $plain = trim(preg_replace('/\s+/', ' ', (string) $plain));
                    $pos = mb_stripos($plain, $q);
                    $snippet = $pos !== false
                        ? mb_substr($plain, max(0, $pos - 45), 140)
                        : mb_substr($plain, 0, 120);
                    return [
                        'clave' => $g['clave'],
                        'titulo' => $g['titulo'],
                        'contenido' => $g['contenido'],
                        'snippet' => $snippet,
                    ];
                })
                ->values()
                ->all();
        }

        $comandos = [];
        if ($tipoFiltro === 'todos' || $tipoFiltro === 'comandos') {
            foreach (ContenidoLoader::getComandos() as $rama) {
                foreach ($rama['comandos'] ?? [] as $cmd) {
                    $hay = mb_strtolower(($cmd['comando'] ?? '') . ' ' . ($cmd['descripcion'] ?? '') . ' ' . ($rama['nombre'] ?? ''));
                    if (str_contains($hay, $q)) {
                        $comandos[] = [
                            'rama' => $rama['nombre'],
                            'icono' => $rama['icono'] ?? '',
                            'comando' => $cmd['comando'],
                            'descripcion' => $cmd['descripcion'],
                        ];
                        if (count($comandos) >= 12) {
                            break 2;
                        }
                    }
                }
            }
        }

        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';

        $preguntas = [];
        if ($tipoFiltro === 'todos' || $tipoFiltro === 'preguntas') {
            $preguntas = Pregunta::query()
                ->select(['id', 'area', 'subarea', 'pregunta'])
                ->where(function ($query) use ($like) {
                    $query->whereRaw('LOWER(id) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(area) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(subarea) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(base, "")) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(pregunta) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(conceptos, "")) LIKE ?', [$like]);
                })
                ->limit(10)
                ->get()
                ->all();
        }

        $recursos = [];
        if ($tipoFiltro === 'todos' || $tipoFiltro === 'recursos') {
            $recursos = Recurso::query()
                ->where(function ($query) use ($like) {
                    $query->whereRaw('LOWER(titulo) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(autores, "")) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(nota, "")) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(subareas, "")) LIKE ?', [$like]);
                })
                ->limit(10)
                ->get()
                ->all();
        }

        return response()->json([
            'guias' => $guias,
            'comandos' => $comandos,
            'preguntas' => $preguntas,
            'recursos' => $recursos,
            'total' => count($guias) + count($comandos) + count($preguntas) + count($recursos),
        ]);
    }

    public function buscarWeb(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $fuente = (string) $request->query('fuente', 'todos');
        if (mb_strlen($q) < 2) {
            return response()->json(['conceptos' => []]);
        }

        $cacheKey = 'egel_web_search_v4_' . sha1($fuente . '|' . mb_strtolower($q));

        $conceptos = Cache::remember($cacheKey, 3600, function () use ($q, $fuente) {
            $rapidas = ['wikipedia', 'wikidata', 'mdn', 'hackernews', 'github', 'stackoverflow'];
            $academicas = ['semanticscholar', 'openalex', 'openlibrary', 'crossref', 'arxiv', 'reddit'];

            $want = function (string $name) use ($fuente, $rapidas, $academicas): bool {
                if ($fuente === 'todos') return true;
                if ($fuente === 'rapidas') return in_array($name, $rapidas, true);
                if ($fuente === 'academicas') return in_array($name, $academicas, true);
                return $fuente === $name;
            };

            $t = 2.5;
            $responses = Http::pool(fn ($pool) => [
                'wiki_es' => $want('wikipedia')
                    ? $pool->as('wiki_es')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://es.wikipedia.org/w/api.php', [
                        'action' => 'query',
                        'generator' => 'search',
                        'gsrsearch' => $q,
                        'gsrlimit' => $fuente === 'wikipedia' ? 6 : 4,
                        'prop' => 'extracts|info',
                        'inprop' => 'url',
                        'exintro' => 1,
                        'explaintext' => 1,
                        'exchars' => 240,
                        'format' => 'json',
                        'utf8' => 1,
                    ])
                    : null,
                'mdn' => $want('mdn')
                    ? $pool->as('mdn')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://developer.mozilla.org/api/v1/search', [
                        'q' => $q,
                        'locale' => 'es',
                        'size' => $fuente === 'mdn' ? 6 : 3,
                    ])
                    : null,
                'so' => $want('stackoverflow')
                    ? $pool->as('so')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://api.stackexchange.com/2.3/search/advanced', [
                        'order' => 'desc',
                        'sort' => 'votes',
                        'q' => $q,
                        'site' => 'stackoverflow',
                        'pagesize' => $fuente === 'stackoverflow' ? 6 : 3,
                    ])
                    : null,
                'openlib' => $want('openlibrary')
                    ? $pool->as('openlib')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://openlibrary.org/search.json', [
                        'q' => $q,
                        'limit' => $fuente === 'openlibrary' ? 6 : 3,
                    ])
                    : null,
                'openalex' => $want('openalex')
                    ? $pool->as('openalex')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://api.openalex.org/works', [
                        'search' => $q,
                        'per-page' => $fuente === 'openalex' ? 6 : 3,
                    ])
                    : null,
                'crossref' => $want('crossref')
                    ? $pool->as('crossref')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (mailto:contacto@astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://api.crossref.org/works', [
                        'query' => $q,
                        'rows' => $fuente === 'crossref' ? 6 : 3,
                    ])
                    : null,
                'arxiv' => $want('arxiv')
                    ? $pool->as('arxiv')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                    ])->get('https://export.arxiv.org/api/query', [
                        'search_query' => 'all:' . $q,
                        'start' => 0,
                        'max_results' => $fuente === 'arxiv' ? 6 : 3,
                    ])
                    : null,
                'github' => $want('github')
                    ? $pool->as('github')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0',
                        'Accept' => 'application/vnd.github+json',
                    ])->get('https://api.github.com/search/repositories', [
                        'q' => $q,
                        'sort' => 'stars',
                        'per_page' => $fuente === 'github' ? 6 : 3,
                    ])
                    : null,
                'wikidata' => $want('wikidata')
                    ? $pool->as('wikidata')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://www.wikidata.org/w/api.php', [
                        'action' => 'wbsearchentities',
                        'search' => $q,
                        'language' => 'es',
                        'uselang' => 'es',
                        'type' => 'item',
                        'limit' => $fuente === 'wikidata' ? 6 : 3,
                        'format' => 'json',
                    ])
                    : null,
                'semanticscholar' => $want('semanticscholar')
                    ? $pool->as('semanticscholar')->timeout($t)->withHeaders([
                        'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                        'Accept' => 'application/json',
                    ])->get('https://api.semanticscholar.org/graph/v1/paper/search', [
                        'query' => $q,
                        'limit' => $fuente === 'semanticscholar' ? 6 : 3,
                        'fields' => 'title,abstract,year,url,citationCount',
                    ])
                    : null,
                'hackernews' => $want('hackernews')
                    ? $pool->as('hackernews')->timeout($t)->withHeaders([
                        'Accept' => 'application/json',
                    ])->get('https://hn.algolia.com/api/v1/search', [
                        'query' => $q,
                        'tags' => 'story',
                        'hitsPerPage' => $fuente === 'hackernews' ? 6 : 3,
                    ])
                    : null,
                'reddit' => $want('reddit')
                    ? $pool->as('reddit')->timeout($t)->withHeaders([
                        'User-Agent' => 'web:ExamenIsoftEGEL:v1.0 (by /u/egel_portal)',
                        'Accept' => 'application/json',
                    ])->get('https://www.reddit.com/search.json', [
                        'q' => $q,
                        'sort' => 'relevance',
                        'limit' => $fuente === 'reddit' ? 6 : 3,
                    ])
                    : null,
            ]);

            $resultados = [];

            // 1. Wikipedia (ES, con fallback a EN si no hay resultados)
            $wikiItems = $this->parseWikipediaResponse($responses['wiki_es'] ?? null, 'es');
            if (empty($wikiItems) && $want('wikipedia')) {
                $wikiItems = $this->consultarWikipedia('en', $q);
            }
            $resultados = array_merge($resultados, $wikiItems);

            // 2. MDN Web Docs
            $mdnResp = $responses['mdn'] ?? null;
            if ($mdnResp instanceof \Illuminate\Http\Client\Response && $mdnResp->ok()) {
                foreach ($mdnResp->json('documents') ?? [] as $doc) {
                    $slug = (string) ($doc['mdn_url'] ?? '');
                    if ($slug === '') continue;
                    $resultados[] = [
                        'title' => (string) ($doc['title'] ?? ''),
                        'extract' => trim((string) ($doc['summary'] ?? '')),
                        'url' => 'https://developer.mozilla.org' . $slug,
                        'source' => 'developer.mozilla.org',
                        'category' => 'mdn',
                    ];
                }
            }

            // 3. Stack Overflow
            $soResp = $responses['so'] ?? null;
            if ($soResp instanceof \Illuminate\Http\Client\Response && $soResp->ok()) {
                foreach ($soResp->json('items') ?? [] as $item) {
                    $link = (string) ($item['link'] ?? '');
                    $title = html_entity_decode((string) ($item['title'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    if ($link === '' || $title === '') continue;
                    $tags = implode(', ', array_slice($item['tags'] ?? [], 0, 4));
                    $score = (int) ($item['score'] ?? 0);
                    $answers = (int) ($item['answer_count'] ?? 0);
                    $resultados[] = [
                        'title' => $title,
                        'extract' => "Votos: {$score} · Respuestas: {$answers}" . ($tags ? " · Etiquetas: {$tags}" : ''),
                        'url' => $link,
                        'source' => 'stackoverflow.com',
                        'category' => 'stackoverflow',
                    ];
                }
            }

            // 4. Open Library
            $olResp = $responses['openlib'] ?? null;
            if ($olResp instanceof \Illuminate\Http\Client\Response && $olResp->ok()) {
                foreach ($olResp->json('docs') ?? [] as $doc) {
                    $key = (string) ($doc['key'] ?? '');
                    $title = (string) ($doc['title'] ?? '');
                    if ($key === '' || $title === '') continue;
                    $autores = implode(', ', array_slice($doc['author_name'] ?? [], 0, 2));
                    $anio = $doc['first_publish_year'] ?? null;
                    $resultados[] = [
                        'title' => $title,
                        'extract' => trim(($autores ?: 'Autor no especificado') . ($anio ? " ({$anio})" : '')),
                        'url' => 'https://openlibrary.org' . $key,
                        'source' => 'openlibrary.org',
                        'category' => 'openlibrary',
                    ];
                }
            }

            // 5. OpenAlex (artículos científicos)
            $oaResp = $responses['openalex'] ?? null;
            if ($oaResp instanceof \Illuminate\Http\Client\Response && $oaResp->ok()) {
                foreach ($oaResp->json('results') ?? [] as $work) {
                    $title = trim((string) ($work['title'] ?? ''));
                    $url = (string) ($work['doi'] ?? $work['id'] ?? '');
                    if ($title === '' || $url === '') continue;
                    $year = $work['publication_year'] ?? null;
                    $cited = (int) ($work['cited_by_count'] ?? 0);
                    $auths = collect($work['authorships'] ?? [])
                        ->take(2)
                        ->map(fn ($a) => $a['author']['display_name'] ?? '')
                        ->filter()
                        ->implode(', ');
                    $resultados[] = [
                        'title' => $title,
                        'extract' => trim(($auths ?: 'Investigación académica') . ($year ? " · {$year}" : '') . " · Citas: {$cited}"),
                        'url' => $url,
                        'source' => 'openalex.org',
                        'category' => 'openalex',
                    ];
                }
            }

            // 6. Crossref (publicaciones con DOI)
            $crResp = $responses['crossref'] ?? null;
            if ($crResp instanceof \Illuminate\Http\Client\Response && $crResp->ok()) {
                foreach ($crResp->json('message.items') ?? [] as $item) {
                    $title = trim((string) ($item['title'][0] ?? ''));
                    $url = (string) ($item['URL'] ?? '');
                    if ($title === '' || $url === '') continue;
                    $publisher = (string) ($item['publisher'] ?? '');
                    $year = $item['published']['date-parts'][0][0] ?? null;
                    $resultados[] = [
                        'title' => $title,
                        'extract' => trim(($publisher ?: 'Publicación académica') . ($year ? " ({$year})" : '')),
                        'url' => $url,
                        'source' => 'crossref.org',
                        'category' => 'crossref',
                    ];
                }
            }

            // 7. arXiv (preprints de computación)
            $axResp = $responses['arxiv'] ?? null;
            if ($axResp instanceof \Illuminate\Http\Client\Response && $axResp->ok()) {
                $xml = @simplexml_load_string($axResp->body());
                if ($xml && isset($xml->entry)) {
                    foreach ($xml->entry as $entry) {
                        $title = trim(preg_replace('/\s+/', ' ', (string) $entry->title));
                        $url = trim((string) $entry->id);
                        $summary = trim(preg_replace('/\s+/', ' ', (string) $entry->summary));
                        if ($title === '' || $url === '') continue;
                        $resultados[] = [
                            'title' => $title,
                            'extract' => mb_substr($summary, 0, 200) . (mb_strlen($summary) > 200 ? '…' : ''),
                            'url' => $url,
                            'source' => 'arxiv.org',
                            'category' => 'arxiv',
                        ];
                    }
                }
            }

            // 8. GitHub (repositorios populares)
            $ghResp = $responses['github'] ?? null;
            if ($ghResp instanceof \Illuminate\Http\Client\Response && $ghResp->ok()) {
                foreach ($ghResp->json('items') ?? [] as $repo) {
                    $name = (string) ($repo['full_name'] ?? '');
                    $url = (string) ($repo['html_url'] ?? '');
                    if ($name === '' || $url === '') continue;
                    $stars = number_format((int) ($repo['stargazers_count'] ?? 0));
                    $lang = (string) ($repo['language'] ?? '');
                    $desc = trim((string) ($repo['description'] ?? ''));
                    $resultados[] = [
                        'title' => $name . ($lang ? " ({$lang})" : ''),
                        'extract' => "★ {$stars}" . ($desc ? " · {$desc}" : ''),
                        'url' => $url,
                        'source' => 'github.com',
                        'category' => 'github',
                    ];
                }
            }

            // 9. Wikidata (grafo de conocimiento estructurado)
            $wdResp = $responses['wikidata'] ?? null;
            if ($wdResp instanceof \Illuminate\Http\Client\Response && $wdResp->ok()) {
                foreach ($wdResp->json('search') ?? [] as $item) {
                    $label = (string) ($item['label'] ?? '');
                    $url = (string) ($item['concepturi'] ?? '');
                    if ($label === '' || $url === '') continue;
                    $desc = trim((string) ($item['description'] ?? 'Entidad de conocimiento estructurado'));
                    $id = (string) ($item['id'] ?? '');
                    $resultados[] = [
                        'title' => $label . ($id ? " ({$id})" : ''),
                        'extract' => $desc,
                        'url' => $url,
                        'source' => 'wikidata.org',
                        'category' => 'wikidata',
                    ];
                }
            }

            // 10. Semantic Scholar (investigación académica con IA)
            $ssResp = $responses['semanticscholar'] ?? null;
            if ($ssResp instanceof \Illuminate\Http\Client\Response && $ssResp->ok()) {
                foreach ($ssResp->json('data') ?? [] as $paper) {
                    $title = trim((string) ($paper['title'] ?? ''));
                    $url = (string) ($paper['url'] ?? '');
                    if ($title === '' || $url === '') continue;
                    $year = $paper['year'] ?? null;
                    $cites = (int) ($paper['citationCount'] ?? 0);
                    $abs = trim((string) ($paper['abstract'] ?? ''));
                    $meta = ($year ? "{$year} · " : '') . "Citas: {$cites}";
                    $resultados[] = [
                        'title' => $title,
                        'extract' => $abs ? "{$meta} — " . mb_substr($abs, 0, 170) . '…' : $meta,
                        'url' => $url,
                        'source' => 'semanticscholar.org',
                        'category' => 'semanticscholar',
                    ];
                }
            }

            // 11. Hacker News (Algolia API)
            $hnResp = $responses['hackernews'] ?? null;
            if ($hnResp instanceof \Illuminate\Http\Client\Response && $hnResp->ok()) {
                foreach ($hnResp->json('hits') ?? [] as $hit) {
                    $title = trim((string) ($hit['title'] ?? ''));
                    $url = (string) ($hit['url'] ?? '');
                    if ($url === '' && !empty($hit['objectID'])) {
                        $url = 'https://news.ycombinator.com/item?id=' . $hit['objectID'];
                    }
                    if ($title === '' || $url === '') continue;
                    $pts = (int) ($hit['points'] ?? 0);
                    $comments = (int) ($hit['num_comments'] ?? 0);
                    $resultados[] = [
                        'title' => $title,
                        'extract' => "Hacker News · {$pts} puntos · {$comments} comentarios",
                        'url' => $url,
                        'source' => 'news.ycombinator.com',
                        'category' => 'hackernews',
                    ];
                }
            }

            // 12. Reddit (discusiones técnicas de comunidad)
            $rdResp = $responses['reddit'] ?? null;
            if ($rdResp instanceof \Illuminate\Http\Client\Response && $rdResp->ok()) {
                foreach ($rdResp->json('data.children') ?? [] as $child) {
                    $post = $child['data'] ?? null;
                    if (!is_array($post)) continue;
                    $title = trim((string) ($post['title'] ?? ''));
                    $permalink = (string) ($post['permalink'] ?? '');
                    if ($title === '' || $permalink === '') continue;
                    $sub = (string) ($post['subreddit_name_prefixed'] ?? 'reddit');
                    $ups = (int) ($post['ups'] ?? 0);
                    $comments = (int) ($post['num_comments'] ?? 0);
                    $resultados[] = [
                        'title' => $title,
                        'extract' => "{$sub} · {$ups} votos · {$comments} comentarios",
                        'url' => 'https://www.reddit.com' . $permalink,
                        'source' => 'reddit.com',
                        'category' => 'reddit',
                    ];
                }
            }

            return $resultados;
        });

        return response()->json([
            'conceptos' => $conceptos,
        ]);
    }

    private function parseWikipediaResponse(mixed $response, string $lang): array
    {
        if (!($response instanceof \Illuminate\Http\Client\Response) || !$response->ok()) {
            return [];
        }

        $pages = $response->json('query.pages');
        if (!is_array($pages)) {
            return [];
        }

        return collect($pages)
            ->sortBy('index')
            ->map(fn ($p) => [
                'title' => (string) ($p['title'] ?? ''),
                'extract' => trim((string) ($p['extract'] ?? '')),
                'url' => (string) ($p['fullurl'] ?? ''),
                'source' => "{$lang}.wikipedia.org",
                'category' => 'wikipedia',
            ])
            ->filter(fn ($item) => $item['title'] !== '' && $item['url'] !== '')
            ->values()
            ->all();
    }

    private function consultarWikipedia(string $lang, string $q): array
    {
        try {
            $response = Http::timeout(4)
                ->withHeaders([
                    'User-Agent' => 'ExamenIsoftEGEL/1.0 (https://egelsoft.astriom.org)',
                    'Accept' => 'application/json',
                ])
                ->get("https://{$lang}.wikipedia.org/w/api.php", [
                    'action' => 'query',
                    'generator' => 'search',
                    'gsrsearch' => $q,
                    'gsrlimit' => 4,
                    'prop' => 'extracts|info',
                    'inprop' => 'url',
                    'exintro' => 1,
                    'explaintext' => 1,
                    'exchars' => 220,
                    'format' => 'json',
                    'utf8' => 1,
                ]);

            return $this->parseWikipediaResponse($response, $lang);
        } catch (\Throwable) {
            return [];
        }
    }
}
