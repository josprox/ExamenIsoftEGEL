<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('modo', 20)->default('inmediato');
            $table->string('area_filtro', 32)->nullable();
            $table->string('banco_filtro', 32)->nullable();
            $table->unsignedInteger('total_preguntas');
            $table->unsignedInteger('aciertos')->default(0);
            $table->unsignedInteger('errores')->default(0);
            $table->unsignedTinyInteger('porcentaje')->default(0);
            $table->boolean('completado')->default(false);
            $table->timestamps();
        });

        Schema::create('respuestas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intento_id')->constrained('intentos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('pregunta_id', 40)->index();
            $table->string('area', 16);
            $table->string('subarea', 16);
            $table->unsignedTinyInteger('seleccionada');
            $table->unsignedTinyInteger('correcta');
            $table->boolean('es_correcta');
            $table->timestamps();

            $table->unique(['intento_id', 'pregunta_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('respuestas');
        Schema::dropIfExists('intentos');
    }
};
