<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Intento extends Model
{
    protected $fillable = [
        'user_id',
        'modo',
        'area_filtro',
        'banco_filtro',
        'pregunta_ids',
        'total_preguntas',
        'aciertos',
        'errores',
        'porcentaje',
        'duracion_segundos',
        'completado',
    ];

    protected function casts(): array
    {
        return [
            'pregunta_ids' => 'array',
            'completado' => 'boolean',
            'total_preguntas' => 'integer',
            'aciertos' => 'integer',
            'errores' => 'integer',
            'porcentaje' => 'integer',
            'duracion_segundos' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function respuestas(): HasMany
    {
        return $this->hasMany(Respuesta::class);
    }
}
