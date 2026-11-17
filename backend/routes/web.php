<?php

use Illuminate\Support\Facades\Route;

// Servir documentos de ../biblioteca de forma segura
Route::get('/biblioteca-files/{path}', function (string $path) {
    $baseDir = realpath(base_path('../biblioteca'));
    if (!$baseDir) {
        abort(404);
    }

    $target = realpath($baseDir . DIRECTORY_SEPARATOR . $path);
    if (!$target || !str_starts_with($target, $baseDir . DIRECTORY_SEPARATOR) || !is_file($target)) {
        abort(404);
    }

    return response()->file($target);
})->where('path', '.*');

// SPA React en producción (cuando existe public/app.html) o estado de API en desarrollo
Route::fallback(function () {
    $spa = public_path('app.html');
    if (is_file($spa)) {
        return response()->file($spa, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    return response()->json([
        'app' => 'EGEL Plus ISOFT API',
        'status' => 'ok',
    ]);
});
