const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config/config.json');
const { authenticateUser, createUser, getUserByUsername } = require('../models/userModel');
const { jwtMiddleware } = require('../middleware');

const router = express.Router();

/**
 * Маршрут для входа пользователя
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать имя пользователя и пароль'
      });
    }
    
    // Аутентификация пользователя
    const authResult = await authenticateUser(username, password);
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: authResult.message
      });
    }
    
    // Создание JWT токена
    const token = jwt.sign(
      {
        id: authResult.user.id,
        username: authResult.user.username,
        role: authResult.user.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    return res.json({
      success: true,
      token,
      user: authResult.user
    });
  } catch (error) {
    console.error('Ошибка при авторизации:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * Маршрут для проверки валидности токена
 * GET /api/auth/verify
 */
router.get('/verify', jwtMiddleware, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

/**
 * Маршрут для создания нового пользователя (только для администраторов)
 * POST /api/auth/users
 */
router.post('/users', jwtMiddleware, async (req, res) => {
  try {
    // Проверка прав администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для выполнения операции'
      });
    }
    
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Не все обязательные поля заполнены'
      });
    }
    
    // Проверка допустимости роли
    const allowedRoles = ['admin', 'editor', 'viewer'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Недопустимое значение роли'
      });
    }
    
    // Создание пользователя
    const result = await createUser({ username, password, role });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(201).json({
      success: true,
      user: result.user
    });
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

module.exports = router;