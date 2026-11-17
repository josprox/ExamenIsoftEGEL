<?php

namespace App\Http\Middleware;

use App\Models\UserToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');
        if (!str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $plainToken = substr($header, 7);
        $hashed = hash('sha256', $plainToken);

        $tokenRecord = UserToken::with('user')
            ->where('token', $hashed)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->first();

        if (!$tokenRecord || !$tokenRecord->user) {
            return response()->json(['message' => 'Token inválido o expirado.'], 401);
        }

        $request->setUserResolver(fn () => $tokenRecord->user);
        $request->attributes->set('current_token_id', $tokenRecord->id);

        return $next($request);
    }
}
