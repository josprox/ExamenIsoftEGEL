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

        $respuestas = Respuesta::where('user_id', $user->id)->get();
        $totalRespuestas = $respuestas->count();
        $totalAciertos = $respuestas->where('es_correcta', true)->count();

        $porArea = [];
        foreach ($respuestas as $r) {
            if (!isset($porArea[$r->area])) {
                $porArea[$r->area] = ['total' => 0, 'aciertos' => 0, 'porcentaje' => 0];
            }
            $porArea[$r->area]['total']++;
            if ($r->es_correcta) {
                $porArea[$r->area]['aciertos']++;
            }
        }
        foreach ($porArea as $area => &$stats) {
            $stats['porcentaje'] = $stats['total'] > 0
                ? (int) round(($stats['aciertos'] / $stats['total']) * 100)
                : 0;
        }
        unset($stats);

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
                'total_intentos' => $intentos->count(),
                'total_respuestas' => $totalRespuestas,
                'total_aciertos' => $totalAciertos,
                'precision_global' => $totalRespuestas > 0
                    ? (int) round(($totalAciertos / $totalRespuestas) * 100)
                    : 0,
                'por_area' => $porArea,
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
        ]);

        $intento = Intento::create([
            'user_id' => $request->user()->id,
            'modo' => $validated['modo'],
            'area_filtro' => $validated['area_filtro'] ?? null,
            'banco_filtro' => $validated['banco_filtro'] ?? null,
            'total_preguntas' => $validated['total_preguntas'],
        ]);

        return response()->json(['intento' => $intento], 201);
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

        $this->recalcularIntento($intento);
        $intento->completado = true;
        $intento->save();

        return response()->json(['intento' => $intento]);
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
