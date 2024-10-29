import { DevBranch } from "../types";

export const getBookingToolDeployUrl = () => {
  switch (process.env.BRANCH_NAME as DevBranch) {
    case "development":
      return "https://development-dot-flowing-mantis-389917.uc.r.appspot.com/";
    case "staging":
      return "https://staging-dot-flowing-mantis-389917.uc.r.appspot.com/";
    default:
      return "https://flowing-mantis-389917.uc.r.appspot.com/";
  }
};
