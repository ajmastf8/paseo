// Local beta builds point the auto-updater at the upstream repo, where a higher
// official release would replace this build and drop our local changes. The
// update UI stays in Settings -> About so it is obvious the capability exists;
// flip this to false and rebuild to re-enable checking and installing.
export const APP_UPDATES_DISABLED = true;
