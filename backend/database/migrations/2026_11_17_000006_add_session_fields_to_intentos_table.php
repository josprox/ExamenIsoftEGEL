<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intentos', function (Blueprint $table) {
            $table->json('pregunta_ids')->nullable()->after('banco_filtro');
            $table->unsignedInteger('duracion_segundos')->default(0)->after('porcentaje');
        });
    }

    public function down(): void
    {
        Schema::table('intentos', function (Blueprint $table) {
            $table->dropColumn(['pregunta_ids', 'duracion_segundos']);
        });
    }
};
