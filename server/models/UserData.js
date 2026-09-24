import mongoose from "mongoose";

const userDataSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    onboarded: {
      type: Boolean,
      default: false,
    },
    profile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    cycles: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    symptomLogs: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    lifestyleLogs: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

const UserData = mongoose.model("UserData", userDataSchema);

export default UserData;
