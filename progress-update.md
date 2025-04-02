# Отчет о проделанной работе - OnlySheet

## Обзор проекта

**OnlySheet** - это система для безопасной работы с электронными таблицами на базе ONLYOFFICE Document Server. Проект предоставляет следующие функции:

- Ролевая модель доступа (администратор, редактор, читатель)
- Защита формул и ячеек от редактирования
- Запрет на скачивание документов
- Возможность совместной работы в реальном времени
- Логирование действий пользователей

## Текущий статус

Базовая инфраструктура проекта настроена и запущена. На данный момент:

- Развернут ONLYOFFICE Document Server в Docker контейнере
- Создано Node.js приложение для серверной части
- Реализован базовый UI на клиентской стороне
- Настроен механизм авторизации с JWT
- Создан администратор по умолчанию

## Структура проекта

```
onlysheet/
├── client/                      # Клиентская часть приложения
│   ├── index.html               # Основной HTML файл
│   ├── styles/                  # CSS стили
│   └── scripts/                 # JavaScript файлы
│       └── main.js              # Основной скрипт клиента
├── server/                      # Серверная часть
│   ├── app.js                   # Входная точка сервера
│   ├── createAdminUser.js       # Скрипт для создания админа
│   ├── db/                      # Директория для JSON файлов базы данных
│   │   └── users.json           # Файл с данными пользователей
│   ├── middleware/              # Промежуточные обработчики
│   │   └── index.js             # JWT аутентификация
│   ├── models/                  # Модели данных
│   │   └── userModel.js         # Модель пользователя
│   └── routes/                  # Маршруты API
│       ├── auth.js              # Маршруты аутентификации
│       └── documents.js         # Маршруты для работы с документами
├── documents/                   # Директория для хранения документов
├── config/                      # Конфигурация приложения
│   └── config.json              # Основной конфигурационный файл
├── onlyoffice/                  # Настройки ONLYOFFICE
│   └── docker-compose.yml       # Файл для запуска ONLYOFFICE в Docker
├── Dockerfile                   # Dockerfile для основного приложения
├── package.json                 # Зависимости NPM
└── README.md                    # Документация проекта
```

## Ключевые фрагменты кода

### Серверная часть (app.js)

```javascript
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const documentsRoutes = require('./routes/documents');
const { jwtMiddleware } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', jwtMiddleware, documentsRoutes);

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
```

### Клиентская часть (index.html)

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OnlySheet - Защищенное редактирование таблиц</title>
    <link rel="stylesheet" href="styles/main.css">
</head>
<body>
    <div class="app-container">
        <header class="header">
            <div class="logo">
                <h1>OnlySheet</h1>
            </div>
            <div class="user-info" id="userInfo">
                <!-- Информация о пользователе будет добавлена через JavaScript -->
            </div>
        </header>

        <main class="main-content">
            <!-- Контейнер для авторизации -->
            <div class="auth-container" id="authContainer">
                <h2>Авторизация</h2>
                <form id="loginForm" class="login-form">
                    <!-- Форма входа -->
                </form>
            </div>

            <!-- Контейнер для списка документов -->
            <div class="documents-container" id="documentsContainer" style="display: none;">
                <!-- Список документов -->
            </div>

            <!-- Контейнер для редактора ONLYOFFICE -->
            <div class="editor-container" id="editorContainer" style="display: none;">
                <!-- Редактор ONLYOFFICE -->
            </div>
        </main>
    </div>

    <!-- Подключение JS -->
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
    <script src="scripts/main.js"></script>
    
    <!-- Подключение API ONLYOFFICE Document Server -->
    <script type="text/javascript" src="https://localhost:8080/web-apps/apps/api/documents/api.js"></script>
</body>
</html>
```

### Docker-compose.yml

```yaml
version: '3'

services:
  document-server:
    container_name: onlyoffice-document-server
    image: onlyoffice/documentserver:latest
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - document-server-data:/var/www/onlyoffice/Data
    restart: always
    environment:
      - JWT_ENABLED=true
      # JWT_SECRET генерируется автоматически при первом запуске
  
  app:
    container_name: onlysheet-app
    build: ..
    ports:
      - "3000:3000"
    depends_on:
      - document-server
    volumes:
      - ../documents:/app/documents
    restart: always
    environment:
      - JWT_SECRET=${JWT_SECRET}

volumes:
  document-server-data:
```

## Текущие проблемы

1. **Проблемы с аутентификацией**:
   - Запрос POST на `http://localhost:3000/api/auth/login` возвращает ошибку 401 (Unauthorized)
   - Основная причина: потенциальная проблема с хешированием пароля или JWT токеном

2. **Проблемы с доступом к ONLYOFFICE Document Server**:
   - Порт 8443 недоступен для подключения
   - Перенаправление на Welcome Page при обращении к localhost:8080
   - Возможная причина: неправильная конфигурация Document Server или проблемы с SSL сертификатами

3. **Проблемы с интеграцией API**:
   - Необходимо настроить интеграцию с API ONLYOFFICE Document Server с использованием JWT
   - JWT включен по умолчанию начиная с версии 7.2 ONLYOFFICE Document Server

## Следующие шаги

1. **Исправление аутентификации**:
   - Проверить и исправить механизм авторизации на сервере
   - Убедиться в корректности генерации и проверки JWT токенов

2. **Настройка интеграции с ONLYOFFICE Document Server**:
   - Правильно настроить JWT интеграцию между нашим приложением и Document Server
   - Получить и использовать JWT ключ из контейнера Document Server

3. **Создание демонстрационных документов**:
   - Добавить примеры документов с различными уровнями защиты ячеек
   - Настроить шаблоны для разных ролей пользователей

4. **Улучшение UI/UX**:
   - Доработать интерфейс пользователя
   - Добавить дополнительные элементы управления для администратора

5. **Тестирование и отладка**:
   - Провести комплексное тестирование всех функций системы
   - Исправить выявленные ошибки и проблемы

## Заключение

Базовая архитектура системы OnlySheet создана и запущена. Текущие проблемы связаны преимущественно с настройкой взаимодействия между нашим приложением и ONLYOFFICE Document Server. После решения текущих проблем с аутентификацией и интеграцией API система будет готова к первому тестированию.