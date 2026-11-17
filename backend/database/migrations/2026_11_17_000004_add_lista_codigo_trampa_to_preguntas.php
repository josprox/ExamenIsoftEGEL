<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('preguntas', function (Blueprint $table) {
            $table->json('lista')->nullable()->after('base');
            $table->longText('codigo')->nullable()->after('lista');
            $table->text('trampa')->nullable()->after('estrategia');
        });
    }

    public function down(): void
    {
        Schema::table('preguntas', function (Blueprint $table) {
            $table->dropColumn(['lista', 'codigo', 'trampa']);
        });
    }
};
