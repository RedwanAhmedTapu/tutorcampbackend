const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  try {
    const secretKey = process.env.JWT_TOKEN ;
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;
