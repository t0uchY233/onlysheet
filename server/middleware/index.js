const jwt = require('jsonwebtoken');
const config = require('../../config/config.json');

/**
 * Middleware для проверки JWT токена
 * @param {Object} req - HTTP запрос
 * @param {Object} res - HTTP ответ
 * @param {Function} next - следующий middleware
 */
const jwtMiddleware = (req, res, next) => {
  // Получение токена из заголовка
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Требуется аутентификация'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Верификация токена
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Добавление данных пользователя в запрос
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Недействительный токен аутентификации'
    });
  }
};

module.exports = {
  jwtMiddleware
};