<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Intento;
use App\Models\Pregunta;
use App\Models\Respuesta;
use App\Services\ContenidoLoader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntentoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $intentos = Intento::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

        $totales = Respuesta::where('user_id', $user->id)
            ->selectRaw('COUNT(*) as total, COALESCE(SUM(CASE WHEN es_correcta = 1 THEN 1 ELSE 0 END), 0) as aciertos')
            ->first();

        $totalRespuestas = (int) ($totales->total ?? 0);
        $totalAciertos = (int) ($totales->aciertos ?? 0);

        $porAreaRows = Respuesta::where('user_id', $user->id)
            ->selectRaw('area, COUNT(*) as total, COALESCE(SUM(CASE WHEN es_correcta = 1 THEN 1 ELSE 0 END), 0) as aciertos')
            ->groupBy('area')
            ->get();

        $porArea = [];
        foreach ($porAreaRows as $row) {
            $t = (int) $row->total;
            $a = (int) $row->aciertos;
            $porArea[$row->area] = [
                'total' => $t,
                'aciertos' => $a,
                'porcentaje' => $t > 0 ? (int) round(($a / $t) * 100) : 0,
            ];
        }

        $porSubareaRows = Respuesta::where('user_id', $user->id)
            ->selectRaw('subarea, COUNT(*) as total, COALESCE(SUM(CASE WHEN es_correcta = 1 THEN 1 ELSE 0 END), 0) as aciertos')
            ->groupBy('subarea')
            ->orderBy('subarea')
            ->get();

        $porSubarea = [];
        foreach ($porSubareaRows as $row) {
            $t = (int) $row->total;
            $a = (int) $row->aciertos;
            $porSubarea[$row->subarea] = [
                'total' => $t,
                'aciertos' => $a,
                'porcentaje' => $t > 0 ? (int) round(($a / $t) * 100) : 0,
            ];
        }

        $erroresRecientes = Respuesta::where('user_id', $user->id)
            ->where('es_correcta', false)
            ->orderByDesc('created_at')
            ->limit(30)
            ->pluck('pregunta_id')
            ->unique()
            ->values()
            ->all();

        return response()->json([
            'intentos' => $intentos,
            'estadisticas' => [
                'total_intentos' => $intentos->where('completado', true)->count(),
                'total_respuestas' => $totalRespuestas,
                'total_aciertos' => $totalAciertos,
                'precision_global' => $totalRespuestas > 0
                    ? (int) round(($totalAciertos / $totalRespuestas) * 100)
                    : 0,
                'por_area' => $porArea,
                'por_subarea' => $porSubarea,
                'errores_recientes' => $erroresRecientes,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (Pregunta::count() === 0) {
            ContenidoLoader::importarTodoABaseDeDatos();
        }
        $validated = $request->validate([
            'modo' => ['required', 'in:inmediato,examen'],
            'area_filtro' => ['nullable', 'string', 'max:32'],
            'banco_filtro' => ['nullable', 'string', 'max:32'],
            'total_preguntas' => ['required', 'integer', 'min:1'],
            'pregunta_ids' => ['nullable', 'array'],
            'pregunta_ids.*' => ['string', 'max:40'],
        ]);

        $intento = Intento::create([
            'user_id' => $request->user()->id,
            'modo' => $validated['modo'],
            'area_filtro' => $validated['area_filtro'] ?? null,
            'banco_filtro' => $validated['banco_filtro'] ?? null,
            'pregunta_ids' => $validated['pregunta_ids'] ?? null,
            'total_preguntas' => $validated['total_preguntas'],
        ]);

        return response()->json(['intento' => $intento], 201);
    }

    public function show(Request $request, Intento $intento): JsonResponse
    {
        if ($intento->user_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $respuestas = $intento->respuestas()
            ->get(['pregunta_id', 'seleccionada', 'correcta', 'es_correcta']);

        $ids = $intento->pregunta_ids;
        if (empty($ids)) {
            $ids = $respuestas->pluck('pregunta_id')->values()->all();
        }

        $preguntasMap = !empty($ids)
            ? Pregunta::whereIn('id', $ids)->get()->keyBy('id')
            : collect();

        $ocultar = !$intento->completado && $intento->modo === 'examen';
        $preguntas = collect($ids)
            ->map(fn ($id) => $preguntasMap->get($id))
            ->filter()
            ->map(fn (Pregunta $p) => $ocultar ? EgelController::ocultarRespuestas($p) : $p)
            ->values();

        return response()->json([
            'intento' => $intento,
            'preguntas' => $preguntas,
            'respuestas' => $respuestas->map(fn (Respuesta $r) => [
                'pregunta_id' => $r->pregunta_id,
                'seleccionada' => $r->seleccionada,
                'es_correcta' => $intento->completado || $intento->modo === 'inmediato' ? $r->es_correcta : null,
            ])->values(),
        ]);
    }

    public function guardarRespuesta(Request $request, Intento $intento): JsonResponse
    {
        if ($intento->user_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }
        if ($intento->completado) {
            return response()->json(['message' => 'El intento ya terminó.'], 409);
        }

        $validated = $request->validate([
            'pregunta_id' => ['required', 'string', 'max:40', 'exists:preguntas,id'],
            'seleccionada' => ['required', 'integer', 'min:0'],
        ]);
        $pregunta = Pregunta::findOrFail($validated['pregunta_id']);
        if ($validated['seleccionada'] >= count($pregunta->opciones)) {
            return response()->json(['message' => 'Opción inválida.'], 422);
        }

        Respuesta::updateOrCreate(
            [
                'intento_id' => $intento->id,
                'pregunta_id' => $validated['pregunta_id'],
            ],
            [
                'user_id' => $request->user()->id,
                'area' => $pregunta->area,
                'subarea' => $pregunta->subarea,
                'seleccionada' => $validated['seleccionada'],
                'correcta' => $pregunta->correcta,
                'es_correcta' => $validated['seleccionada'] === $pregunta->correcta,
            ]
        );

        $this->recalcularIntento($intento);

        return response()->json(['intento' => $intento->fresh()]);
    }

    public function finalizar(Request $request, Intento $intento): JsonResponse
    {
        if ($intento->user_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $validated = $request->validate([
            'duracion_segundos' => ['nullable', 'integer', 'min:0'],
        ]);

        $this->recalcularIntento($intento);
        if (isset($validated['duracion_segundos'])) {
            $intento->duracion_segundos = $validated['duracion_segundos'];
        }
        $intento->completado = true;
        $intento->save();

        $preguntas = [];
        if (!empty($intento->pregunta_ids)) {
            $map = Pregunta::whereIn('id', $intento->pregunta_ids)->get()->keyBy('id');
            $preguntas = collect($intento->pregunta_ids)
                ->map(fn ($id) => $map->get($id))
                ->filter()
                ->values();
        }

        return response()->json([
            'intento' => $intento,
            'preguntas' => $preguntas,
        ]);
    }

    public function destroy(Request $request, Intento $intento): JsonResponse
    {
        if ($intento->user_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $intento->delete();

        return response()->json(['message' => 'Intento eliminado.']);
    }

    private function recalcularIntento(Intento $intento): void
    {
        $aciertos = $intento->respuestas()->where('es_correcta', true)->count();
        $errores = $intento->respuestas()->where('es_correcta', false)->count();
        $total = max(1, $intento->total_preguntas);
        $porcentaje = (int) round(($aciertos / $total) * 100);
        $intento->update([
            'aciertos' => $aciertos,
            'errores' => $errores,
            'porcentaje' => $porcentaje,
        ]);
    }
}
