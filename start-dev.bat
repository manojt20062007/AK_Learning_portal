@echo off
echo Starting AK Learning Platform...
echo.
echo Backend: http://localhost:4000
echo Frontend: http://localhost:3000
echo Admin: http://localhost:3000/login
echo.
echo Admin credentials: admin@aklms.com / Admin@AK2024!
echo.
start "AK Backend" cmd /k "cd /d f:\Projects\AkLearningPlatform\apps\backend && set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ak_learning_platform && set SESSION_SECRET=ak-learning-dev-session-secret-change-in-production-must-be-64-chars-long && set NODE_ENV=development && set PORT=4000 && set CORS_ORIGIN=http://localhost:3000 && set CSRF_SECRET=ak-learning-dev-csrf-secret-change-in-production && npx ts-node-dev --respawn --transpile-only --exit-child -r tsconfig-paths/register src/index.ts"
timeout /t 3 /nobreak >nul
start "AK Frontend" cmd /k "cd /d f:\Projects\AkLearningPlatform\apps\frontend && npx next dev --port 3000"
echo.
echo Both servers starting. Check the opened windows for logs.
