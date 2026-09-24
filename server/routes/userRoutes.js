import express from "express";
import UserData from "../models/UserData.js";

const router = express.Router();

// GET user data by userId
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let userData = await UserData.findOne({ userId });

    if (!userData) {
      // Return default empty structure if user doesn't exist yet
      return res.json({
        userId,
        onboarded: false,
        profile: {},
        cycles: [],
        symptomLogs: [],
        lifestyleLogs: [],
      });
    }

    res.json({
      userId: userData.userId,
      onboarded: userData.onboarded,
      profile: userData.profile || {},
      cycles: userData.cycles || [],
      symptomLogs: userData.symptomLogs || [],
      lifestyleLogs: userData.lifestyleLogs || [],
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// POST/PUT save or update user data
router.post("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { onboarded, profile, cycles, symptomLogs, lifestyleLogs } = req.body;

    const updatedData = await UserData.findOneAndUpdate(
      { userId },
      {
        userId,
        onboarded: Boolean(onboarded),
        profile: profile || {},
        cycles: cycles || [],
        symptomLogs: symptomLogs || [],
        lifestyleLogs: lifestyleLogs || [],
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "Data saved successfully to MongoDB",
      data: updatedData,
    });
  } catch (error) {
    console.error("Error saving user data:", error);
    res.status(500).json({ error: "Failed to save user data" });
  }
});

// DELETE reset user data
router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await UserData.deleteOne({ userId });
    res.json({ success: true, message: "User data reset successfully" });
  } catch (error) {
    console.error("Error deleting user data:", error);
    res.status(500).json({ error: "Failed to reset user data" });
  }
});

export default router;
