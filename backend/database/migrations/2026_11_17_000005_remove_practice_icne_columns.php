<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('intentos', 'icne_estimado')) {
            Schema::table('intentos', fn (Blueprint $table) => $table->dropColumn('icne_estimado'));
        }
        if (Schema::hasColumn('intentos', 'nivel_estimado')) {
            Schema::table('intentos', fn (Blueprint $table) => $table->dropColumn('nivel_estimado'));
        }
    }

    public function down(): void
    {
        Schema::table('intentos', function (Blueprint $table) {
            $table->unsignedSmallInteger('icne_estimado')->nullable();
            $table->string('nivel_estimado', 40)->nullable();
        });
    }
};
