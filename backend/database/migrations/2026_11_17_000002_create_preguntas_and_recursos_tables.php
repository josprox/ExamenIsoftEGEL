<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('preguntas', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('area', 16)->index();
            $table->string('subarea', 16)->index();
            $table->string('banco', 32)->index();
            $table->string('formato', 40);
            $table->string('nivel', 24)->nullable();
            $table->longText('estimulo')->nullable();
            $table->longText('base')->nullable();
            $table->text('pregunta');
            $table->json('opciones');
            $table->unsignedTinyInteger('correcta');
            $table->text('estrategia')->nullable();
            $table->json('conceptos')->nullable();
            $table->json('fuentes')->nullable();
            $table->timestamps();
        });

        Schema::create('recursos', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('titulo', 255);
            $table->string('autores', 255)->nullable();
            $table->unsignedSmallInteger('anio')->nullable();
            $table->string('tipo', 32)->index();
            $table->json('areas');
            $table->json('subareas')->nullable();
            $table->boolean('oficial')->default(false);
            $table->string('archivo', 500)->nullable();
            $table->string('url', 500)->nullable();
            $table->integer('prioridad')->nullable();
            $table->text('nota')->nullable();
            $table->boolean('gratuito')->default(false);
            $table->string('idioma', 16)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recursos');
        Schema::dropIfExists('preguntas');
    }
};
