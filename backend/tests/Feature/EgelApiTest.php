<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EgelApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_auth_register_login_and_me(): void
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Estudiante EGEL',
            'email' => 'estudiante@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $register->assertStatus(201)->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'estudiante@example.com',
            'password' => 'secret123',
        ]);

        $login->assertStatus(200)->assertJsonStructure(['user', 'token']);
        $token = $login->json('token');

        $me = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/auth/me');
        $me->assertStatus(200)->assertJsonPath('user.email', 'estudiante@example.com');
    }

    public function test_temario_preguntas_y_biblioteca(): void
    {
        $this->getJson('/api/temario')
            ->assertStatus(200)
            ->assertJsonPath('temario.id', 'egel-plus-isoft-2026');

        $this->getJson('/api/preguntas?area=A1&limit=5')
            ->assertStatus(200)
            ->assertJsonCount(5, 'preguntas');

        $simulacro = $this->getJson('/api/preguntas?preset=egel_completo')
            ->assertStatus(200)
            ->assertJsonPath('total', 203);
        $preguntas = collect($simulacro->json('preguntas'));
        $this->assertSame(143, $preguntas->whereIn('area', ['A1', 'A2', 'A3', 'A4'])->count());
        $this->assertSame(60, $preguntas->whereIn('area', ['L1', 'L2'])->count());
        $this->assertSame(12, $preguntas->where('subarea', 'L1.1')->count());
        $this->assertSame(12, $preguntas->where('subarea', 'L1.2')->count());
        $this->assertSame(6, $preguntas->where('subarea', 'L1.3')->count());
        $this->assertSame(15, $preguntas->where('subarea', 'L2.1')->count());
        $this->assertSame(15, $preguntas->where('subarea', 'L2.2')->count());
        $this->assertFalse($preguntas->contains(fn ($p) => $p['banco'] === 'reto'));

        $rapida = collect($this->getJson('/api/preguntas?preset=practica_rapida')
            ->assertStatus(200)
            ->assertJsonPath('total', 20)
            ->json('preguntas'));
        $this->assertSame(['A1' => 3, 'A2' => 3, 'A3' => 5, 'A4' => 3, 'L1' => 3, 'L2' => 3],
            $rapida->countBy('area')->all());

        $this->getJson('/api/biblioteca?solo_archivo=1')
            ->assertStatus(200)
            ->assertJsonStructure(['recursos', 'total']);

        $this->getJson('/api/guias')
            ->assertStatus(200)
            ->assertJsonStructure(['guias']);

        $this->getJson('/api/comandos')
            ->assertStatus(200)
            ->assertJsonStructure(['ramas']);

        $this->getJson('/api/buscar?q=ISO')
            ->assertStatus(200)
            ->assertJsonStructure(['guias', 'comandos', 'preguntas', 'recursos']);
    }

    public function test_intento_con_retroalimentacion_inmediata(): void
    {
        $reg = $this->postJson('/api/auth/register', [
            'name' => 'Ana',
            'email' => 'ana@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);
        $token = $reg->json('token');

        $intentoRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/intentos', [
                'modo' => 'inmediato',
                'area_filtro' => 'A1',
                'banco_filtro' => 'base',
                'total_preguntas' => 2,
            ]);

        $intentoRes->assertStatus(201);
        $intentoId = $intentoRes->json('intento.id');

        $resp1 = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/intentos/{$intentoId}/respuestas", [
                'pregunta_id' => 'A1-001',
                'seleccionada' => 2,
                'correcta' => 0,
                'es_correcta' => false,
            ]);

        $resp1->assertStatus(200)
            ->assertJsonPath('intento.aciertos', 1)
            ->assertJsonPath('intento.errores', 0);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/intentos/{$intentoId}/respuestas", [
                'pregunta_id' => 'A1-001',
                'seleccionada' => 4,
            ])->assertStatus(422);

        $fin = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/intentos/{$intentoId}/finalizar");

        $fin->assertStatus(200)
            ->assertJsonPath('intento.completado', true)
            ->assertJsonPath('intento.porcentaje', 50);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/intentos/{$intentoId}/respuestas", [
                'pregunta_id' => 'A1-001',
                'seleccionada' => 0,
            ])->assertStatus(409);

        $historial = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/intentos');

        $historial->assertStatus(200)
            ->assertJsonPath('estadisticas.total_intentos', 1)
            ->assertJsonPath('estadisticas.total_aciertos', 1);
    }
}
