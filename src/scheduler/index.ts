import { getPlatform } from "../config.js";
import * as launchd from "./launchd.js";
import * as cron from "./cron.js";

export async function installScheduler(warmyPath: string): Promise<void> {
  const platform = getPlatform();

  if (platform === "macos") {
    await launchd.installLaunchd(warmyPath);
  } else if (platform === "linux") {
    await cron.installCron(warmyPath);
  } else {
    throw new Error("Windows scheduler not implemented yet");
  }
}

export async function uninstallScheduler(): Promise<void> {
  const platform = getPlatform();

  if (platform === "macos") {
    await launchd.uninstallLaunchd();
  } else if (platform === "linux") {
    await cron.uninstallCron();
  } else {
    throw new Error("Windows scheduler not implemented yet");
  }
}

export async function isSchedulerInstalled(): Promise<boolean> {
  const platform = getPlatform();

  if (platform === "macos") {
    return await launchd.isLaunchdInstalled();
  } else if (platform === "linux") {
    return await cron.isCronInstalled();
  }
  throw new Error("Windows scheduler not implemented yet");
}