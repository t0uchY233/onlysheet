const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dbDir = path.join(__dirname, 'db');
const usersPath = path.join(dbDir, 'users.json');

// Создаем директорию db, если она не существует
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Генерируем хеш пароля
const password = 'admin';
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Ошибка хеширования пароля:', err);
    return;
  }

  // Данные пользователя
  const userData = {
    users: [
      {
        id: '1',
        username: 'admin',
        passwordHash: hash,
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ]
  };

  // Записываем данные в файл
  fs.writeFileSync(usersPath, JSON.stringify(userData, null, 2));
  
  console.log('Пользователь admin создан с паролем admin');
  console.log('Хеш пароля:', hash);
});