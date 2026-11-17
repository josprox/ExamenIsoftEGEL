<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pregunta extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'area',
        'subarea',
        'banco',
        'formato',
        'nivel',
        'estimulo',
        'base',
        'lista',
        'codigo',
        'pregunta',
        'opciones',
        'correcta',
        'estrategia',
        'trampa',
        'conceptos',
        'fuentes',
    ];

    protected function casts(): array
    {
        return [
            'lista' => 'array',
            'opciones' => 'array',
            'conceptos' => 'array',
            'fuentes' => 'array',
            'correcta' => 'integer',
        ];
    }
}
