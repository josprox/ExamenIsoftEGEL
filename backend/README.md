# API Laravel del simulador EGEL

Laravel sirve el temario, las preguntas, las guías, la biblioteca y los intentos de práctica. `app/Services/ContenidoLoader.php` importa los archivos de `../contenido/`.

1. Ejecuta `composer install`.
2. Copia `.env.example` a `.env` y configura la base de datos.
3. Ejecuta `php artisan key:generate` y `php artisan migrate`.
4. Ejecuta `php artisan egel:importar` al iniciar y cada vez que cambien los bancos o recursos.
5. Inicia el servidor con `php artisan serve` y comprueba con `php artisan test`.

La API calcula los aciertos a partir de la respuesta correcta almacenada en la base de datos. Solo devuelve porcentajes de práctica; no estima la escala ICNE oficial.
