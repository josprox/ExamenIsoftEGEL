<?php

namespace App\Services;

use App\Models\Pregunta;
use App\Models\Recurso;
use Illuminate\Support\Facades\File;

class ContenidoLoader
{
    public static function contenidoPath(string $relative = ''): string
    {
        $base = realpath(base_path('../contenido')) ?: base_path('../contenido');
        return $relative ? $base . DIRECTORY_SEPARATOR . ltrim($relative, '/\\') : $base;
    }

    public static function getTemario(): ?array
    {
        $manifestPath = self::contenidoPath('manifest.json');
        if (!File::exists($manifestPath)) {
            return null;
        }
        $manifest = json_decode(File::get($manifestPath), true);
        $activeId = $manifest['temarioActivo'] ?? null;
        foreach ($manifest['temarios'] ?? [] as $t) {
            if ($t['id'] === $activeId) {
                $temarioPath = self::contenidoPath($t['archivo']);
                return File::exists($temarioPath)
                    ? json_decode(File::get($temarioPath), true)
                    : null;
            }
        }
        return null;
    }

    public static function cargarPreguntasDesdeArchivos(): array
    {
        $manifestPath = self::contenidoPath('manifest.json');
        if (!File::exists($manifestPath)) {
            return [];
        }
        $manifest = json_decode(File::get($manifestPath), true);
        $activeId = $manifest['temarioActivo'] ?? null;
        $bancos = [];
        foreach ($manifest['temarios'] ?? [] as $t) {
            if ($t['id'] === $activeId) {
                $bancos = $t['bancos'] ?? [];
                break;
            }
        }

        $preguntas = [];
        foreach ($bancos as $rutaBanco) {
            $full = self::contenidoPath($rutaBanco);
            if (!File::exists($full)) {
                continue;
            }
            $data = json_decode(File::get($full), true);
            $area = $data['area'] ?? 'GENERAL';
            $banco = $data['banco'] ?? 'base';
            $estimulos = [];
            foreach ($data['estimulos'] ?? [] as $e) {
                $estimulos[$e['id']] = $e['texto'] ?? '';
            }

            foreach ($data['preguntas'] ?? [] as $p) {
                $estId = $p['estimulo'] ?? null;
                $preguntas[] = [
                    'id' => $p['id'],
                    'area' => $p['area'] ?? (str_starts_with($p['subarea'], 'L1.') ? 'L1' : (str_starts_with($p['subarea'], 'L2.') ? 'L2' : $area)),
                    'subarea' => $p['subarea'],
                    'banco' => $banco,
                    'formato' => $p['formato'],
                    'nivel' => $p['nivel'] ?? null,
                    'estimulo' => $estId && isset($estimulos[$estId]) ? $estimulos[$estId] : null,
                    'base' => $p['base'] ?? null,
                    'lista' => $p['lista'] ?? null,
                    'codigo' => $p['codigo'] ?? null,
                    'pregunta' => $p['pregunta'],
                    'opciones' => $p['opciones'],
                    'correcta' => (int) $p['correcta'],
                    'estrategia' => $p['estrategia'] ?? null,
                    'trampa' => $p['trampa'] ?? null,
                    'conceptos' => $p['conceptos'] ?? [],
                    'fuentes' => $p['fuentes'] ?? [],
                ];
            }
        }

        return $preguntas;
    }

    public static function cargarRecursosDesdeArchivo(): array
    {
        $path = self::contenidoPath('recursos.json');
        if (!File::exists($path)) {
            return [];
        }
        $data = json_decode(File::get($path), true);
        return $data['recursos'] ?? [];
    }

    public static function importarTodoABaseDeDatos(): array
    {
        $preguntas = self::cargarPreguntasDesdeArchivos();
        foreach ($preguntas as $p) {
            Pregunta::updateOrCreate(['id' => $p['id']], $p);
        }

        $recursos = self::cargarRecursosDesdeArchivo();
        foreach ($recursos as $r) {
            Recurso::updateOrCreate(
                ['id' => $r['id']],
                [
                    'titulo' => $r['titulo'],
                    'autores' => $r['autores'] ?? null,
                    'anio' => $r['anio'] ?? null,
                    'tipo' => $r['tipo'] ?? 'libro',
                    'areas' => $r['areas'] ?? [],
                    'subareas' => $r['subareas'] ?? [],
                    'oficial' => (bool) ($r['oficial'] ?? false),
                    'archivo' => $r['archivo'] ?? null,
                    'url' => $r['url'] ?? null,
                    'prioridad' => $r['prioridad'] ?? null,
                    'nota' => $r['nota'] ?? null,
                    'gratuito' => (bool) ($r['gratuito'] ?? false),
                    'idioma' => $r['idioma'] ?? null,
                ]
            );
        }

        return [
            'preguntas' => count($preguntas),
            'recursos' => count($recursos),
        ];
    }

    public static function getGuias(): array
    {
        $manifestPath = self::contenidoPath('manifest.json');
        if (!File::exists($manifestPath)) {
            return [];
        }
        $manifest = json_decode(File::get($manifestPath), true);
        $activeId = $manifest['temarioActivo'] ?? null;
        $guiasMap = [];
        foreach ($manifest['temarios'] ?? [] as $t) {
            if ($t['id'] === $activeId) {
                $guiasMap = $t['guias'] ?? [];
                break;
            }
        }

        $resultado = [];
        foreach ($guiasMap as $clave => $ruta) {
            $full = self::contenidoPath($ruta);
            if (!File::exists($full)) {
                continue;
            }
            $contenido = File::get($full);
            $titulo = $clave;
            if (preg_match('/^#\s+(.+)$/m', $contenido, $m)) {
                $titulo = trim($m[1]);
            }
            $resultado[] = [
                'clave' => $clave,
                'titulo' => $titulo,
                'contenido' => $contenido,
            ];
        }

        return $resultado;
    }

    public static function getComandos(): array
    {
        $manifestPath = self::contenidoPath('manifest.json');
        if (!File::exists($manifestPath)) {
            return [];
        }
        $manifest = json_decode(File::get($manifestPath), true);
        $resultado = [];
        foreach ($manifest['comandos'] ?? [] as $ruta) {
            $full = self::contenidoPath($ruta);
            if (!File::exists($full)) {
                continue;
            }
            $data = json_decode(File::get($full), true);
            if ($data) {
                $resultado[] = $data;
            }
        }
        return $resultado;
    }
}
