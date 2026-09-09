import assert from "node:assert/strict";
import { test } from "node:test";

import {
  customScheduleValue,
  formatBackupSchedule,
  scheduleToPreset,
  validateBackupRetentionCount,
  validateCronExpression,
  validatePositiveInteger,
} from "./backup-config.ts";

test("accepts valid cron expressions", () => {
  for (const cron of [
    "0 0 * * *",
    "0 */6 * * *",
    "0 0 1,15 * *",
    "30 2-4 * * 1-5",
    "  0 0 * * 0  ",
    "0 0 * 1,6-8 *",
  ]) {
    assert.equal(validateCronExpression(cron), undefined, cron);
  }
});

test("rejects invalid cron expressions", () => {
  for (const cron of [
    "",
    "* * * *",
    "* * * * * *",
    "60 * * * *",
    "* 24 * * *",
    "* * 0 * *",
    "* * * 13 *",
    "* * * * 7",
    "5-3 * * * *",
    "*/0 * * * *",
    "a * * * *",
    "1,,2 * * * *",
  ]) {
    assert.notEqual(validateCronExpression(cron), undefined, cron);
  }
});

test("maps schedules to presets", () => {
  assert.equal(scheduleToPreset("0 0 * * *"), "0 0 * * *");
  assert.equal(scheduleToPreset("0 3 * * *"), customScheduleValue);
  assert.equal(formatBackupSchedule("0 0 * * *"), "Daily");
  assert.equal(formatBackupSchedule("0 3 * * *"), "Custom (0 3 * * *)");
});

test("validates positive integers", () => {
  assert.equal(validatePositiveInteger(""), undefined);
  assert.equal(validatePositiveInteger("3"), undefined);
  assert.notEqual(validatePositiveInteger("0"), undefined);
  assert.notEqual(validatePositiveInteger("-1"), undefined);
  assert.notEqual(validatePositiveInteger("1.5"), undefined);
  assert.notEqual(validatePositiveInteger("abc"), undefined);
});

test("requires a retention count", () => {
  assert.notEqual(validateBackupRetentionCount(""), undefined);
  assert.notEqual(validateBackupRetentionCount("0"), undefined);
  assert.equal(validateBackupRetentionCount("7"), undefined);
});
