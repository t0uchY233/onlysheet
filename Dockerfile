FROM node:16-alpine

WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm install --production

# Копирование исходного кода
COPY . .

# Создание директорий для документов и базы данных
RUN mkdir -p documents
RUN mkdir -p server/db

# Настройка прав доступа
RUN chmod -R 755 /app
RUN chmod -R 777 /app/documents
RUN chmod -R 777 /app/server/db

# Открытие порта
EXPOSE 3000

# Запуск приложения
CMD ["node", "server/app.js"]