<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

//login
Route::post('/auth/login', [AuthController::class, 'login']);

Route::group(['middleware' => 'auth:api'], function () {
   //refresh token
   Route::post('/auth/refresh', [AuthController::class, 'refresh']);

   //logout
   Route::post('/auth/logout', [AuthController::class, 'logout']);

   //get user info
   Route::get('/auth/me', [AuthController::class, 'me']);
});