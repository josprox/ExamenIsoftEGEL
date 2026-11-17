<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pregunta;
use App\Models\Recurso;
use App\Services\ContenidoLoader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        if (Recurso::count() === 0) {
            ContenidoLoader::importarTodoABaseDeDatos();
        }

        $recursos = Recurso::orderByRaw('COALESCE(prioridad, 99) ASC')
            ->orderBy('titulo')
            ->get();

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
}
