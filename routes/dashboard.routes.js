const controller = require("../controllers/dashboard.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

router.get("/dashboard", [authMiddleware.verifyToken, authMiddleware.isAdmin], controller.getDashboardStats);

module.exports = router;