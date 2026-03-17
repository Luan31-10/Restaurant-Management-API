// routes/ai.routes.js
const controller = require("../controllers/ai.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// API sẽ có dạng: GET /api/ai/recommendations/5 (với 5 là ID của món ăn vừa được thêm)
router.get(
    "/recommendations/:menuItemId",
    [authMiddleware.verifyToken],
    controller.getRecommendations
);

router.get(
    "/bestsellers",
    [authMiddleware.verifyToken],
    controller.getBestsellers
);
module.exports = router;