const mongoose = require('mongoose');

/**
 * Answers 404 for a URL whose [names] parameter is not a database id
 * ("abc", "../..", very long text) before the route runs. Without it such a
 * value reaches a query, fails to cast and comes back as a 500 server error.
 * The body carries both the app ({error}) and dashboard ({success, message})
 * shapes.
 */
function rejectInvalidObjectIdParams(router, names) {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(String(value))) {
        return next();
      }
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود',
        error: 'Not found',
        code: 'INVALID_ID',
      });
    });
  }
}

module.exports = { rejectInvalidObjectIdParams };
