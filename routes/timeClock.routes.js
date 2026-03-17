// File: routes/timeClock.routes.js
const controller = require("../controllers/timeClock.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// Routes cho nhân viên
router.post("/timeclock/clock-in", [authMiddleware.verifyToken], controller.clockIn);
router.post("/timeclock/clock-out", [authMiddleware.verifyToken], controller.clockOut);

// Route cho admin
router.get("/reports/timekeeping", [authMiddleware.verifyToken, authMiddleware.isAdmin], controller.getTimekeepingReport);

router.get("/timeclock/status", [authMiddleware.verifyToken], controller.getClockInStatus);
router.get("/reports/timekeeping/details", [authMiddleware.verifyToken, authMiddleware.isAdmin], controller.getDetailedTimekeepingReport);


module.exports = router;