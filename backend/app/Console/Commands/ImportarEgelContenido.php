<?php

namespace App\Console\Commands;

use App\Services\ContenidoLoader;
use Illuminate\Console\Command;

class ImportarEgelContenido extends Command
{
    protected $signature = 'egel:importar';
    protected $description = 'Importa preguntas y recursos desde ../contenido hacia la base de datos';

    public function handle(): int
    {
        $res = ContenidoLoader::importarTodoABaseDeDatos();
        $this->info("Importación completada: {$res['preguntas']} preguntas y {$res['recursos']} recursos.");
        return self::SUCCESS;
    }
}
