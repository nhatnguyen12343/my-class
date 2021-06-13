const express = require("express");

const router = express.Router();
const { verifySession } = require("../middlewares/authentication");
const { validateBody, validateQuery } = require("../validators");
const { usersControllers } = require("../controllers");
const { usersSchema } = require("../schemas");
require("express-async-errors");

// router.use(verifyToken);

router.post("/auth/register", validateBody(usersSchema.create), usersControllers.createUser);
router.post("/auth/login", validateBody(usersSchema.login), usersControllers.login);
router.get("/", validateQuery(usersSchema.getList), usersControllers.getUsers);
router.get("/:id", usersControllers.getUser);
router.put("/:id", validateBody(usersSchema.update), usersControllers.updateUser);
router.put("/:id/follow", validateBody(usersSchema.follow), usersControllers.followUser);
router.put("/:id/unfollow", validateBody(usersSchema.unFollow), usersControllers.unfollowUser);
router.delete("/:id", usersControllers.deleteUser);

module.exports = router;
