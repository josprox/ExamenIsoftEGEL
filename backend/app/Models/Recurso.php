<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recurso extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'titulo',
        'autores',
        'anio',
        'tipo',
        'areas',
        'subareas',
        'oficial',
        'archivo',
        'url',
        'prioridad',
        'nota',
        'gratuito',
        'idioma',
    ];

    protected function casts(): array
    {
        return [
            'areas' => 'array',
            'subareas' => 'array',
            'oficial' => 'boolean',
            'gratuito' => 'boolean',
            'anio' => 'integer',
            'prioridad' => 'integer',
        ];
    }
}
