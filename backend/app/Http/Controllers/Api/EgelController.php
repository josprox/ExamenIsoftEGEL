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

            return response()->json([
                'preguntas' => $seleccion->values(),
                'total' => $seleccion->count(),
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

        return response()->json([
            'preguntas' => $preguntas,
            'total' => $preguntas->count(),
        ]);
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
        $q = mb_strtolower(trim((string) $request->query('q', '')));
        $soloArchivo = $request->boolean('solo_archivo');

        $filtrados = $recursos->filter(function (Recurso $r) use ($area, $tipo, $q, $soloArchivo) {
            if ($area && !in_array($area, $r->areas ?? [], true)) {
                return false;
            }
            if ($tipo && $r->tipo !== $tipo) {
                return false;
            }
            if ($soloArchivo && empty($r->archivo)) {
                return false;
            }
            if ($q !== '') {
                $haystack = mb_strtolower(
                    ($r->titulo ?? '') . ' ' . ($r->autores ?? '') . ' ' . ($r->nota ?? '')
                );
                if (!str_contains($haystack, $q)) {
                    return false;
                }
            }
            return true;
        })->values();

        return response()->json([
            'recursos' => $filtrados,
            'total' => $filtrados->count(),
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
        if (mb_strlen($q) < 2) {
            return response()->json([
                'guias' => [],
                'comandos' => [],
                'preguntas' => [],
                'recursos' => [],
            ]);
        }

        if (Pregunta::count() === 0 || Recurso::count() === 0) {
            ContenidoLoader::importarTodoABaseDeDatos();
        }

        $guias = collect(ContenidoLoader::getGuias())
            ->filter(fn ($g) => str_contains(mb_strtolower($g['titulo'] . ' ' . $g['contenido']), $q))
            ->take(8)
            ->values();

        $comandos = [];
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
                    if (count($comandos) >= 10) {
                        break 2;
                    }
                }
            }
        }

        $preguntas = Pregunta::all()
            ->filter(fn (Pregunta $p) => str_contains(
                mb_strtolower($p->id . ' ' . ($p->base ?? '') . ' ' . $p->pregunta . ' ' . implode(' ', $p->conceptos ?? [])),
                $q
            ))
            ->take(8)
            ->values();

        $recursos = Recurso::all()
            ->filter(fn (Recurso $r) => str_contains(
                mb_strtolower($r->titulo . ' ' . ($r->autores ?? '') . ' ' . ($r->nota ?? '')),
                $q
            ))
            ->take(8)
            ->values();

        return response()->json([
            'guias' => $guias,
            'comandos' => $comandos,
            'preguntas' => $preguntas,
            'recursos' => $recursos,
        ]);
    }
}
