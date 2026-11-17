<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EgelController;
use App\Http\Controllers\Api\IntentoController;
use App\Http\Middleware\AuthenticateApiToken;
use Illuminate\Support\Facades\Route;

// Autenticación
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware(AuthenticateApiToken::class)->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// Catálogos públicos
Route::get('/temario', [EgelController::class, 'temario']);
Route::get('/biblioteca', [EgelController::class, 'biblioteca']);
Route::get('/guias', [EgelController::class, 'guias']);
Route::get('/comandos', [EgelController::class, 'comandos']);
Route::get('/buscar', [EgelController::class, 'buscar']);

// Simulador, progreso e intentos (requiere login)
Route::middleware(AuthenticateApiToken::class)->group(function () {
    Route::get('/preguntas', [EgelController::class, 'preguntas']);
    Route::get('/intentos', [IntentoController::class, 'index']);
    Route::post('/intentos', [IntentoController::class, 'store']);
    Route::post('/intentos/{intento}/respuestas', [IntentoController::class, 'guardarRespuesta']);
    Route::post('/intentos/{intento}/finalizar', [IntentoController::class, 'finalizar']);
    Route::delete('/intentos/{intento}', [IntentoController::class, 'destroy']);
});
