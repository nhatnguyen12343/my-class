/* eslint-disable radix */
const { Users, Followers, Followings } = require("../datasources/mongodb/models");
const { convertSelectQuery, buildSortStringToObject } = require("../helpers/query.helper");
const { SKIP_DEFAULT, LIMIT_DEFAULT } = require("../constants/global.constant");

async function createUser(data) {
    const user = new Users(data);
    user.setPassword(data.password);
    await user.save();
    return user;
}

async function getListUsers(query) {
    const {
        skip = SKIP_DEFAULT,
        limit = LIMIT_DEFAULT,
        sort,
        select,
        search_text: searchText,
        is_all: isAll = 0
    } = query;

    const conditions = {};
    const selects = convertSelectQuery(select);
    const sortObject = buildSortStringToObject(sort);

    if (searchText) {
        conditions.$or = [
            { name: { $regex: searchText.trim(), $options: "i" } },
            { email: { $regex: searchText.trim(), $options: "i" } }
        ];
    }

    const [users = [], total = 0] = await Promise.all([
        Users
            .find(conditions)
            .sort(sortObject)
            .skip(parseInt(isAll) ? 0 : Number(skip))
            .limit(parseInt(isAll) ? 0 : Number(limit))
            .select(selects)
            .lean(),
        Users.countDocuments(conditions)
    ]);
    return { users, total };
}

async function getUser(id) {
    const user = await Users.findById(id).lean();
    return user;
}

async function updateUser(id, data) {
    const userUpdated = await Users.findByIdAndUpdate(id, { $set: data }, { new: true });
    return userUpdated;
}

async function handleFollow(data) {
    const { userId, followerId } = data;
    /* create follower  */
    const [follower, following] = await Promise.all([
        Followers.create({ userId: followerId, followerId: userId }),
        Followings.create({ userId, followingId: followerId })
    ]);
    /* update total follower &  following for user */
    const [userFollowerUpdated, userFollowingUpdated] = await Promise.all([
        Users.findByIdAndUpdate(userId, { $inc: { totalFollowings: 1 } }, { new: true }),
        Users.findByIdAndUpdate(followerId, { $inc: { totalFollowers: 1 } }, { new: true })
    ]);

    return userFollowerUpdated;
}

async function handleFollowTransation(userId, data) {
    const { followerId } = data;
    const session = await Users.startSession();
    session.startTransaction();
    try {
    /* create follower  */
        const follower = await Followers.create([{ userId: followerId, followerId: userId }], { session });
        console.log("follower", follower);
        const following = await Followings.create([{ userId, followingId: followerId }], { session });
        console.log("following", following);

        /* update total follower &  following for user */
        const userFollowerUpdated = await Users.findByIdAndUpdate(
            userId,
            { $inc: { totalFollowings: 1 } },
            { session, new: true }
        ).lean();

        const userFollowingUpdated = await Users.findByIdAndUpdate(
            followerId,
            { $inc: { totalFollowers: 1 } },
            { session, new: true }
        ).lean();

        await session.commitTransaction();
        session.endSession();
        return userFollowerUpdated;
    } catch (error) {
        console.error("error", error);
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

async function handleUnFollow(data) {
    const { userId, unFollowerId } = data;
    /* create follower  */
    const [follower, following] = await Promise.all([
        Followers.deleteOne({ userId: unFollowerId, followerId: userId }),
        Followings.deleteOne({ userId, followingId: unFollowerId })
    ]);
    /* update total follower &  following for user */
    const [userUnFollowerUpdated, userFollowingUpdated] = await Promise.all([
        Users.findByIdAndUpdate(userId, { $inc: { totalFollowings: -1 } }, { new: true }),
        Users.findByIdAndUpdate(unFollowerId, { $inc: { totalFollowers: -1 } }, { new: true })
    ]);

    return userUnFollowerUpdated;
}

module.exports = {
    createUser,
    getListUsers,
    getUser,
    updateUser,
    handleFollow,
    handleUnFollow
};
