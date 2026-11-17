<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Respuesta extends Model
{
    protected $fillable = [
        'intento_id',
        'user_id',
        'pregunta_id',
        'area',
        'subarea',
        'seleccionada',
        'correcta',
        'es_correcta',
    ];

    protected function casts(): array
    {
        return [
            'seleccionada' => 'integer',
            'correcta' => 'integer',
            'es_correcta' => 'boolean',
        ];
    }

    public function intento(): BelongsTo
    {
        return $this->belongsTo(Intento::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
