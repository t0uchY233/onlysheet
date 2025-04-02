const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Путь к файлу с данными пользователей
const usersPath = path.join(__dirname, '../db/users.json');

/**
 * Получение всех пользователей
 * @returns {Array} Массив пользователей
 */
const getAllUsers = () => {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(usersPath)) {
      return [];
    }
    
    const data = fs.readFileSync(usersPath, 'utf8');
    const users = JSON.parse(data).users || [];
    
    return users.map(user => {
      // Скрываем хеши паролей при возвращении данных
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    });
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    return [];
  }
};

/**
 * Получение пользователя по имени пользователя
 * @param {string} username - Имя пользователя для поиска
 * @returns {Object|null} Объект пользователя или null
 */
const getUserByUsername = (username) => {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(usersPath)) {
      return null;
    }
    
    const data = fs.readFileSync(usersPath, 'utf8');
    const users = JSON.parse(data).users || [];
    
    return users.find(user => user.username === username) || null;
  } catch (error) {
    console.error('Ошибка при поиске пользователя:', error);
    return null;
  }
};

/**
 * Создание нового пользователя
 * @param {Object} userData - Данные нового пользователя
 * @returns {Object} Результат операции
 */
const createUser = async (userData) => {
  try {
    // Проверка наличия обязательных полей
    if (!userData.username || !userData.password || !userData.role) {
      return {
        success: false,
        message: 'Не все обязательные поля заполнены'
      };
    }
    
    // Проверка существования директории
    const dbDir = path.dirname(usersPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Загрузка текущих пользователей
    let users = [];
    if (fs.existsSync(usersPath)) {
      const data = fs.readFileSync(usersPath, 'utf8');
      users = JSON.parse(data).users || [];
    }
    
    // Проверка на дубликат пользователя
    if (users.some(user => user.username === userData.username)) {
      return {
        success: false,
        message: 'Пользователь с таким именем уже существует'
      };
    }
    
    // Генерация хеша пароля
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    // Создание нового пользователя
    const newUser = {
      id: String(users.length + 1),
      username: userData.username,
      passwordHash,
      role: userData.role,
      createdAt: new Date().toISOString()
    };
    
    // Добавление пользователя и сохранение файла
    users.push(newUser);
    fs.writeFileSync(usersPath, JSON.stringify({ users }, null, 2));
    
    // Возвращаем безопасную версию пользователя (без хеша пароля)
    const { passwordHash: _, ...safeUser } = newUser;
    
    return {
      success: true,
      user: safeUser
    };
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
    return {
      success: false,
      message: 'Внутренняя ошибка сервера'
    };
  }
};

/**
 * Аутентификация пользователя
 * @param {string} username - Имя пользователя
 * @param {string} password - Пароль
 * @returns {Promise<Object>} Результат аутентификации
 */
const authenticateUser = async (username, password) => {
  try {
    const user = getUserByUsername(username);
    
    if (!user) {
      return {
        success: false,
        message: 'Неверное имя пользователя или пароль'
      };
    }
    
    // Проверка пароля
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordMatch) {
      return {
        success: false,
        message: 'Неверное имя пользователя или пароль'
      };
    }
    
    // Возвращаем безопасную версию пользователя (без хеша пароля)
    const { passwordHash, ...safeUser } = user;
    
    return {
      success: true,
      user: safeUser
    };
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    return {
      success: false,
      message: 'Внутренняя ошибка сервера'
    };
  }
};

module.exports = {
  getAllUsers,
  getUserByUsername,
  createUser,
  authenticateUser
};